package com.medianet.auth.service;

import com.medianet.auth.dto.CreateRoleRequest;
import com.medianet.auth.dto.RoleDto;
import com.medianet.auth.dto.UpdateRoleDefinitionRequest;
import com.medianet.auth.entity.Permission;
import com.medianet.auth.entity.Role;
import com.medianet.auth.entity.User;
import com.medianet.auth.repository.PermissionRepository;
import com.medianet.auth.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin-managed role definitions: create custom roles, pick their permissions,
 * optionally INHERIT another role (the child holds every permission of its
 * parent chain, live), rename/delete them. Built-in (system) roles are
 * protected — they cannot be renamed, deleted or re-parented, and ADMIN's
 * permission set is immutable (always ALL).
 *
 * <p>Every change to a role's effective permission set live-notifies all users
 * holding the role — or any role that inherits from it (see
 * {@link AuthEventService}).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RoleService {

    private final RoleRepository       roleRepository;
    private final PermissionRepository permissionRepository;
    private final AuthEventService     authEventService;

    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getId))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public RoleDto createRole(CreateRoleRequest req) {
        String name = req.getName().trim().toUpperCase();
        if (roleRepository.existsByName(name)) {
            throw new IllegalArgumentException("Un rôle nommé " + name + " existe déjà");
        }
        Role parent = resolveParent(req.getParentName());
        Set<Permission> ownPerms = resolvePermissions(PermissionUtils.expandWithRead(req.getPermissions()));

        // The creator effectively grants own + inherited permissions.
        Set<Permission> effective = new HashSet<>(ownPerms);
        if (parent != null) effective.addAll(parent.getEffectivePermissions());
        PermissionUtils.requireAdminToGrantAdminScope(effective);

        Role role = Role.builder()
                .name(name)
                .displayName(req.getDisplayName().trim())
                .description(req.getDescription())
                .systemRole(false)
                .permissions(ownPerms)
                .parent(parent)
                .build();
        return toDto(roleRepository.save(role));
    }

    public RoleDto updateRole(Long id, UpdateRoleDefinitionRequest req) {
        Role role = findRole(id);
        Set<String> effectiveBefore = slugsOf(role.getEffectivePermissions());
        boolean identityChanged = false;

        if (req.getName() != null && !req.getName().isBlank()) {
            String newName = req.getName().trim().toUpperCase();
            if (!newName.equals(role.getName())) {
                if (role.isSystemRole()) {
                    throw new IllegalArgumentException("Les rôles système ne peuvent pas être renommés");
                }
                if (roleRepository.existsByName(newName)) {
                    throw new IllegalArgumentException("Un rôle nommé " + newName + " existe déjà");
                }
                role.setName(newName);
                identityChanged = true;
            }
        }
        if (req.getDisplayName() != null && !req.getDisplayName().isBlank()) {
            role.setDisplayName(req.getDisplayName().trim());
        }
        if (req.getDescription() != null) {
            role.setDescription(req.getDescription());
        }

        if (req.getPermissions() != null) {
            if ("ADMIN".equals(role.getName())) {
                throw new IllegalArgumentException(
                        "Le rôle ADMIN détient toujours toutes les permissions — il n'est pas modifiable");
            }
            role.setPermissions(resolvePermissions(PermissionUtils.expandWithRead(req.getPermissions())));
        }

        // Parent: null = unchanged, "" = remove, otherwise re-parent.
        if (req.getParentName() != null) {
            if (role.isSystemRole()) {
                throw new IllegalArgumentException("Les rôles système ne peuvent pas hériter d'un autre rôle");
            }
            if (req.getParentName().isBlank()) {
                role.setParent(null);
            } else {
                Role parent = resolveParent(req.getParentName());
                // Cycle guard: the new parent must not be this role or one of
                // its descendants (i.e. this role must not be an ancestor of it).
                if (parent != null && parent.hasAncestorOrSelf(role)) {
                    throw new IllegalArgumentException(
                            "Héritage impossible : cela créerait un cycle (" + parent.getName()
                                    + " hérite déjà de " + role.getName() + ")");
                }
                role.setParent(parent);
            }
        }

        Set<String> effectiveAfter = slugsOf(role.getEffectivePermissions());
        // Only genuinely NEW effective permissions require the admin-scope check.
        Set<Permission> added = role.getEffectivePermissions().stream()
                .filter(p -> !effectiveBefore.contains(p.getSlug()))
                .collect(Collectors.toSet());
        PermissionUtils.requireAdminToGrantAdminScope(added);

        roleRepository.save(role);

        if (!effectiveAfter.equals(effectiveBefore) || identityChanged) {
            authEventService.permissionsChanged(userIdsOfRoleTree(role));
        }
        return toDto(role);
    }

    public void deleteRole(Long id) {
        Role role = findRole(id);
        if (role.isSystemRole()) {
            throw new IllegalArgumentException("Les rôles système ne peuvent pas être supprimés");
        }
        List<String> children = roleRepository.findAll().stream()
                .filter(r -> r.getParent() != null && id.equals(r.getParent().getId()))
                .map(Role::getName).sorted().toList();
        if (!children.isEmpty()) {
            throw new IllegalArgumentException(
                    "Ce rôle est hérité par : " + String.join(", ", children)
                            + " — retirez d'abord cet héritage");
        }
        int holders = role.getUsers().size();
        if (holders > 0) {
            throw new IllegalArgumentException(
                    "Ce rôle est attribué à " + holders + " utilisateur(s) — retirez-le d'abord de leurs comptes");
        }
        roleRepository.delete(role);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Role findRole(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rôle introuvable : " + id));
    }

    /** Resolve a parent role name; ADMIN cannot be inherited. */
    private Role resolveParent(String parentName) {
        if (parentName == null || parentName.isBlank()) return null;
        String upper = parentName.trim().toUpperCase();
        if ("ADMIN".equals(upper)) {
            throw new IllegalArgumentException(
                    "Le rôle ADMIN ne peut pas être hérité — attribuez plutôt le rôle ADMIN directement");
        }
        return roleRepository.findByName(upper)
                .orElseThrow(() -> new IllegalArgumentException("Rôle parent inconnu : " + upper));
    }

    private Set<Permission> resolvePermissions(Set<String> slugs) {
        Set<Permission> result = new HashSet<>();
        if (slugs == null) return result;
        for (String slug : slugs) {
            result.add(permissionRepository.findBySlug(slug)
                    .orElseThrow(() -> new IllegalArgumentException("Permission inconnue : " + slug)));
        }
        return result;
    }

    /**
     * All users holding this role OR any role that inherits from it — a parent
     * edit must live-refresh every child-role holder too.
     */
    private Set<Long> userIdsOfRoleTree(Role role) {
        Set<Long> ids = new HashSet<>();
        for (Role r : roleRepository.findAll()) {
            if (r.hasAncestorOrSelf(role)) {
                r.getUsers().forEach(u -> ids.add(u.getId()));
            }
        }
        return ids;
    }

    private static Set<String> slugsOf(Set<Permission> perms) {
        return perms.stream().map(Permission::getSlug).collect(Collectors.toSet());
    }

    private RoleDto toDto(Role role) {
        return RoleDto.builder()
                .id(role.getId())
                .name(role.getName())
                .displayName(role.getDisplayName())
                .description(role.getDescription())
                .systemRole(role.isSystemRole())
                .permissions(role.getPermissions() == null ? Set.of() : slugsOf(role.getPermissions()))
                .parentName(role.getParent() == null ? null : role.getParent().getName())
                .inheritedPermissions(slugsOf(role.getInheritedPermissions()))
                .userCount(role.getUsers() == null ? 0 : role.getUsers().size())
                .build();
    }
}
