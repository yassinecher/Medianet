package com.medianet.auth.controller;

import com.medianet.auth.entity.Role;
import com.medianet.auth.entity.User;
import com.medianet.auth.repository.PermissionRepository;
import com.medianet.auth.repository.RoleRepository;
import com.medianet.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregated user/role statistics for the back-office Reports module.
 * Gated by the ADMIN-scoped {@code reports:read} permission.
 */
@RestController
@RequestMapping("/api/auth/reports")
@RequiredArgsConstructor
public class ReportController {

    private final UserRepository       userRepository;
    private final RoleRepository       roleRepository;
    private final PermissionRepository permissionRepository;

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> usersReport() {
        List<User> users = userRepository.findAll();
        List<Role> roles = roleRepository.findAll();

        long active = users.stream().filter(User::isActive).count();

        Map<String, Long> byRole = new LinkedHashMap<>();
        for (Role r : roles) byRole.put(r.getName(), 0L);
        for (User u : users) {
            for (String r : u.getRoleNames()) byRole.merge(r, 1L, Long::sum);
        }

        long withDirectPerms = users.stream()
                .filter(u -> !u.getDirectPermissionSlugs().isEmpty()).count();

        // Sign-ups per month, last 12 months (oldest first).
        Map<String, Long> signupsByMonth = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(LocalDate.now()).minusMonths(11);
        for (int i = 0; i < 12; i++) { signupsByMonth.put(cursor.toString(), 0L); cursor = cursor.plusMonths(1); }
        for (User u : users) {
            if (u.getCreatedAt() == null) continue;
            String key = YearMonth.from(u.getCreatedAt()).toString();
            signupsByMonth.computeIfPresent(key, (k, v) -> v + 1);
        }

        List<Map<String, Object>> rolesDetail = new ArrayList<>();
        for (Role r : roles) {
            rolesDetail.add(Map.of(
                    "name", r.getName(),
                    "displayName", r.getDisplayName(),
                    "systemRole", r.isSystemRole(),
                    "userCount", byRole.getOrDefault(r.getName(), 0L),
                    "permissionCount", r.getPermissions() == null ? 0 : r.getPermissions().size()));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalUsers", users.size());
        out.put("activeUsers", active);
        out.put("disabledUsers", users.size() - active);
        out.put("usersWithDirectPermissions", withDirectPerms);
        out.put("byRole", byRole);
        out.put("signupsByMonth", signupsByMonth);
        out.put("roles", rolesDetail);
        out.put("customRoles", roles.stream().filter(r -> !r.isSystemRole()).count());
        out.put("permissionsInCatalog", permissionRepository.count());
        return ResponseEntity.ok(out);
    }
}
