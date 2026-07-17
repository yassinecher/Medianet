package com.medianet.auth;

import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import com.medianet.auth.service.ModuleCatalog;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.*;

@SpringBootApplication
@EnableScheduling   // SSE heartbeat (AuthEventService)
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }

    @Bean
    CommandLineRunner initData(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            AdminProfileRepository adminProfileRepository,
            PasswordEncoder passwordEncoder) {

        return args -> {

            // ── 1. Seed Permissions from the ModuleCatalog (single source of
            //       truth for labels, descriptions and GENERAL/ADMIN scopes).
            //       Labels + scopes are re-synced on every boot so catalog
            //       changes reach existing rows.
            for (ModuleCatalog.ModuleDef mod : ModuleCatalog.MODULES) {
                for (String action : mod.actions()) {
                    upsertPermission(permissionRepository,
                            mod.key() + ":" + action,
                            ModuleCatalog.ACTION_LABELS.get(action) + " — " + mod.label(),
                            mod.key(), mod.scope());
                }
            }
            // Special (non-CRUD) permissions, e.g. jury evaluation / admin decision.
            for (ModuleCatalog.SpecialDef sp : ModuleCatalog.SPECIALS) {
                upsertPermission(permissionRepository, sp.slug(), sp.label(),
                        sp.slug().split(":")[0], sp.scope());
            }
            // The ModuleCatalog is authoritative: prune any permission row it does
            // not define (old modules like "reports", stale one-off slugs, …) —
            // unlink from every role/user first, then delete.
            pruneUnknownPermissions(permissionRepository, roleRepository, userRepository,
                    ModuleCatalog.expectedSlugs());

            // ── 2. Seed Roles with default permissions ────────────────────────
            // Front-office (non-admin) modules — the ONLY ones a non-admin may hold.
            // Each non-admin role gets read access to these; the back-office modules
            // (dashboard, users, organizations, landing, ai, reports, settings,
            // notifications) are reserved for ADMIN.
            String[] frontofficeReadModules = { "programmes", "candidatures", "sessions", "tasks", "organizations" };
            Set<Permission> frontofficeReads = new HashSet<>();
            for (String m : frontofficeReadModules) {
                frontofficeReads.add(perm(permissionRepository, m + ":read"));
            }

            // Non-admin roles now get the WRITE perms their front-office pages use,
            // not just :read — so a porteur can apply + manage their organisation, a
            // mentor can advance tasks, and a jury can evaluate. (Back-office write
            // endpoints stay ADMIN-gated; these drive FO visibility + the limited-
            // admin checks.)
            Set<Permission> porteurPerms = new HashSet<>(frontofficeReads);
            porteurPerms.add(perm(permissionRepository, "candidatures:create")); // postuler
            porteurPerms.add(perm(permissionRepository, "organizations:create")); // créer son organisation
            porteurPerms.add(perm(permissionRepository, "tasks:update"));         // avancer ses tâches
            // NB: NOT organizations:update — that authority also unlocks the org
            // DELETE endpoint (cross-tenant). Editing uses the open PUT endpoint.

            Set<Permission> mentorPerms  = new HashSet<>(frontofficeReads);
            mentorPerms.add(perm(permissionRepository, "tasks:update"));          // suivi des tâches

            Set<Permission> juryPerms    = new HashSet<>(frontofficeReads);
            juryPerms.add(perm(permissionRepository, "candidatures:evaluate"));

            Set<Permission> candidatPerms = new HashSet<>(Arrays.asList(
                perm(permissionRepository, "programmes:read"),
                perm(permissionRepository, "sessions:read")
            ));

            seedRole(roleRepository, "ADMIN",   "Administrateur",       "Accès complet au système",                      new HashSet<>(permissionRepository.findAll()));
            seedRole(roleRepository, "PORTEUR",  "Porteur de projet",    "Porteur de projet candidatant à une session",   porteurPerms);
            seedRole(roleRepository, "JURY",     "Membre du jury",       "Évalue les candidatures lors d'une session",    juryPerms);
            seedRole(roleRepository, "MENTOR",   "Mentor",               "Accompagne les startups incubées",              mentorPerms);
            seedRole(roleRepository, "CANDIDAT", "Candidat",             "Utilisateur enregistré sans rôle attribué",     candidatPerms);

            // Role permissions are now admin-editable (see RoleController), so the
            // boot no longer overwrites them — except ADMIN, which always holds
            // every permission (including any newly seeded ones).
            syncRolePerms(roleRepository, "ADMIN", new HashSet<>(permissionRepository.findAll()));

            // Mark the built-in roles as system roles (undeletable, name locked).
            for (String name : new String[]{ "ADMIN", "PORTEUR", "JURY", "MENTOR", "CANDIDAT" }) {
                roleRepository.findByName(name).ifPresent(r -> {
                    if (!r.isSystemRole()) { r.setSystemRole(true); roleRepository.save(r); }
                });
            }

            // ── 3. Seed admin user ────────────────────────────────────────────
            if (userRepository.findByEmail("admin@medianet.dz").isEmpty()) {
                Role adminRole = roleRepository.findByName("ADMIN")
                        .orElseThrow(() -> new RuntimeException("ADMIN role not found"));

                User admin = User.builder()
                        .email("admin@medianet.dz")
                        .password(passwordEncoder.encode("Admin1234!"))
                        .firstName("Admin")
                        .lastName("Medianet")
                        .roles(new HashSet<>(Set.of(adminRole)))
                        .directPermissions(new HashSet<>())
                        .active(true)
                        .build();
                admin.setCreatedAt(LocalDateTime.now());
                userRepository.save(admin);

                adminProfileRepository.save(AdminProfile.builder()
                        .user(admin)
                        .department("Direction Générale")
                        .adminLevel("SUPER_ADMIN")
                        .build());
            }

            // NB: direct permissions are no longer restricted to front-office
            // modules — an admin may grant ANY permission to ANY user from the
            // back-office, and those grants must survive restarts.

            // NB: porteur organisations are created ONLY on genuine porteur
            // registration (self-register / invitation-as-porteur). Being added
            // as a MEMBER of someone else's organisation never spawns an owned
            // org — so there is no blanket backfill here on purpose.
        };
    }

    /** Create the permission if missing; otherwise re-sync label/category/scope. */
    private void upsertPermission(PermissionRepository repo, String slug,
                                  String displayName, String category, String scope) {
        Permission p = repo.findBySlug(slug).orElseGet(() ->
                Permission.builder().slug(slug).displayName(displayName).build());
        p.setDisplayName(displayName);
        p.setCategory(category);
        p.setScope(scope);
        repo.save(p);
    }

    /** Remove every permission the catalog does not define (unlink from roles/users first). */
    private void pruneUnknownPermissions(PermissionRepository permissionRepository,
                                         RoleRepository roleRepository,
                                         UserRepository userRepository,
                                         Set<String> expectedSlugs) {
        List<Permission> obsolete = permissionRepository.findAll().stream()
                .filter(p -> !expectedSlugs.contains(p.getSlug()))
                .toList();
        if (obsolete.isEmpty()) return;
        Set<String> slugs = new HashSet<>();
        obsolete.forEach(p -> slugs.add(p.getSlug()));
        for (Role r : roleRepository.findAll()) {
            if (r.getPermissions() != null && r.getPermissions().removeIf(p -> slugs.contains(p.getSlug()))) {
                roleRepository.save(r);
            }
        }
        for (User u : userRepository.findAll()) {
            if (u.getDirectPermissions() != null && u.getDirectPermissions().removeIf(p -> slugs.contains(p.getSlug()))) {
                userRepository.save(u);
            }
        }
        permissionRepository.deleteAll(obsolete);
    }

    private Permission perm(PermissionRepository repo, String slug) {
        return repo.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("Permission not found: " + slug));
    }

    private void seedRole(RoleRepository repo, String name, String displayName,
                          String description, Set<Permission> permissions) {
        if (!repo.existsByName(name)) {
            repo.save(Role.builder()
                    .name(name)
                    .displayName(displayName)
                    .description(description)
                    .permissions(permissions)
                    .systemRole(true)
                    .build());
        }
    }

    /** Overwrite a role's permission set (idempotent re-sync on every boot). */
    private void syncRolePerms(RoleRepository repo, String name, Set<Permission> permissions) {
        repo.findByName(name).ifPresent(role -> {
            role.setPermissions(new HashSet<>(permissions));
            repo.save(role);
        });
    }
}
