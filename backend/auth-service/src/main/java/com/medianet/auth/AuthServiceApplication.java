package com.medianet.auth;

import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@SpringBootApplication
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

            // ── 1. Seed Permissions — CRUD per back-office module ─────────────
            String[] modules = { "dashboard", "programmes", "candidatures", "tasks",
                    "notifications", "users", "organizations", "landing", "ai",
                    "reports", "settings", "sessions" };
            String[][] actions = {
                { "read", "Voir" }, { "create", "Créer" }, { "update", "Modifier" }, { "delete", "Supprimer" }
            };
            for (String m : modules) {
                for (String[] a : actions) {
                    seedPermission(permissionRepository, m + ":" + a[0], a[1] + " — " + m, m);
                }
            }
            // Special candidature actions (jury evaluation / admin decision).
            seedPermission(permissionRepository, "candidatures:evaluate", "Évaluer les candidatures", "candidatures");
            seedPermission(permissionRepository, "candidatures:decide",   "Accepter / rejeter les candidatures", "candidatures");

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

            Set<Permission> porteurPerms = new HashSet<>(frontofficeReads);
            Set<Permission> mentorPerms  = new HashSet<>(frontofficeReads);
            Set<Permission> juryPerms    = new HashSet<>(frontofficeReads);
            juryPerms.add(perm(permissionRepository, "candidatures:evaluate"));
            Set<Permission> candidatPerms = new HashSet<>(Arrays.asList(
                perm(permissionRepository, "sessions:read")
            ));

            seedRole(roleRepository, "ADMIN",   "Administrateur",       "Accès complet au système",                      new HashSet<>(permissionRepository.findAll()));
            seedRole(roleRepository, "PORTEUR",  "Porteur de projet",    "Porteur de projet candidatant à une session",   porteurPerms);
            seedRole(roleRepository, "JURY",     "Membre du jury",       "Évalue les candidatures lors d'une session",    juryPerms);
            seedRole(roleRepository, "MENTOR",   "Mentor",               "Accompagne les startups incubées",              mentorPerms);
            seedRole(roleRepository, "CANDIDAT", "Candidat",             "Utilisateur enregistré sans rôle attribué",     candidatPerms);

            // Re-sync role → permissions every boot so existing rows pick up changes.
            // ADMIN holds ALL permissions; non-admin roles hold only their FO set.
            syncRolePerms(roleRepository, "ADMIN",    new HashSet<>(permissionRepository.findAll()));
            syncRolePerms(roleRepository, "PORTEUR",  porteurPerms);
            syncRolePerms(roleRepository, "JURY",     juryPerms);
            syncRolePerms(roleRepository, "MENTOR",   mentorPerms);
            syncRolePerms(roleRepository, "CANDIDAT", candidatPerms);

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

            // ── 4. Enforce: non-admin users may hold only FRONT-OFFICE direct
            //       permissions. Strip any admin-module direct perms left over.
            Set<String> foModules = new HashSet<>(Arrays.asList(frontofficeReadModules));
            for (User u : userRepository.findAll()) {
                if (u.hasRole("ADMIN")) continue;
                Set<Permission> kept = u.getDirectPermissions().stream()
                        .filter(p -> foModules.contains(p.getSlug().split(":")[0]))
                        .collect(Collectors.toCollection(HashSet::new));
                if (kept.size() != u.getDirectPermissions().size()) {
                    u.setDirectPermissions(kept);
                    userRepository.save(u);
                }
            }
        };
    }

    private void seedPermission(PermissionRepository repo, String slug,
                                 String displayName, String category) {
        if (!repo.existsBySlug(slug)) {
            repo.save(Permission.builder()
                    .slug(slug)
                    .displayName(displayName)
                    .category(category)
                    .build());
        }
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
