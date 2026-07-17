package com.medianet.auth.controller;

import com.medianet.auth.dto.CreateRoleRequest;
import com.medianet.auth.dto.RoleDto;
import com.medianet.auth.dto.UpdateRoleDefinitionRequest;
import com.medianet.auth.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Role definitions management (dynamic RBAC): an admin — or anyone granted the
 * roles:* permissions — can create custom roles, assign permissions to them,
 * rename and delete them.
 */
@RestController
@RequestMapping("/api/auth/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    /** Full role catalog with permissions and holder counts.
     *  Readable by role managers AND user managers (the users page lists roles). */
    @GetMapping
    @PreAuthorize("hasAuthority('roles:read') or hasAuthority('users:read')")
    public ResponseEntity<List<RoleDto>> getAllRoles() {
        return ResponseEntity.ok(roleService.getAllRoles());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('roles:create')")
    public ResponseEntity<RoleDto> createRole(@Valid @RequestBody CreateRoleRequest request) {
        return ResponseEntity.status(201).body(roleService.createRole(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('roles:update')")
    public ResponseEntity<RoleDto> updateRole(@PathVariable Long id,
                                              @Valid @RequestBody UpdateRoleDefinitionRequest request) {
        return ResponseEntity.ok(roleService.updateRole(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('roles:delete')")
    public ResponseEntity<Void> deleteRole(@PathVariable Long id) {
        roleService.deleteRole(id);
        return ResponseEntity.noContent().build();
    }
}
