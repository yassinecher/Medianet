package com.medianet.auth.service;

import com.medianet.auth.entity.Permission;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Shared permission-slug helpers (used for user grants and role definitions). */
public final class PermissionUtils {

    private PermissionUtils() {}

    /** Whether the current request is authenticated as an ADMIN. */
    public static boolean callerIsAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
    }

    /**
     * ADMIN-scoped permissions (back-office access) may only be handed out by an
     * administrator — a non-admin holding users:update / roles:update can manage
     * platform permissions but cannot escalate anyone into the back-office.
     */
    public static void requireAdminToGrantAdminScope(Collection<Permission> permissions) {
        if (callerIsAdmin()) return;
        List<String> adminSlugs = permissions.stream()
                .filter(Permission::isAdminScope)
                .map(Permission::getSlug).sorted().toList();
        if (!adminSlugs.isEmpty()) {
            throw new AccessDeniedException(
                    "Seul un administrateur peut attribuer des permissions d'administration : "
                            + String.join(", ", adminSlugs));
        }
    }

    /** Auto-read rule: any "module:create|update|delete" also implies "module:read". */
    public static Set<String> expandWithRead(Set<String> slugs) {
        Set<String> out = new HashSet<>();
        if (slugs == null) return out;
        for (String s : slugs) {
            if (s == null || s.isBlank()) continue;
            out.add(s);
            int i = s.indexOf(':');
            if (i > 0) {
                String action = s.substring(i + 1);
                if (action.equals("create") || action.equals("update") || action.equals("delete")) {
                    out.add(s.substring(0, i) + ":read");
                }
            }
        }
        return out;
    }
}
