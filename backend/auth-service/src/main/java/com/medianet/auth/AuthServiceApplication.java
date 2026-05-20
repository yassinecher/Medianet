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

            // ── 1. Seed Permissions ───────────────────────────────────────────
            seedPermission(permissionRepository, "users:read",               "Voir les utilisateurs",              "users");
            seedPermission(permissionRepository, "users:write",              "Gérer les utilisateurs",             "users");
            seedPermission(permissionRepository, "users:assign-roles",       "Assigner des rôles",                 "users");
            seedPermission(permissionRepository, "users:assign-permissions", "Assigner des permissions",           "users");
            seedPermission(permissionRepository, "sessions:read",            "Voir les sessions",                  "sessions");
            seedPermission(permissionRepository, "sessions:write",           "Gérer les sessions",                 "sessions");
            seedPermission(permissionRepository, "candidatures:read",        "Voir les candidatures",              "candidatures");
            seedPermission(permissionRepository, "candidatures:write",       "Gérer les candidatures",             "candidatures");
            seedPermission(permissionRepository, "candidatures:evaluate",    "Évaluer les candidatures",           "candidatures");
            seedPermission(permissionRepository, "candidatures:decide",      "Accepter / rejeter les candidatures","candidatures");
            seedPermission(permissionRepository, "reports:read",             "Voir les rapports",                  "reports");

            // ── 2. Seed Roles with default permissions ────────────────────────
            Set<Permission> adminPerms = new HashSet<>(permissionRepository.findAll());

            Set<Permission> juryPerms = Set.of(
                perm(permissionRepository, "candidatures:read"),
                perm(permissionRepository, "candidatures:evaluate"),
                perm(permissionRepository, "sessions:read")
            );

            Set<Permission> mentorPerms = Set.of(
                perm(permissionRepository, "candidatures:read"),
                perm(permissionRepository, "sessions:read")
            );

            Set<Permission> porteurPerms = Set.of(
                perm(permissionRepository, "sessions:read"),
                perm(permissionRepository, "candidatures:read")
            );

            Set<Permission> candidatPerms = Set.of(
                perm(permissionRepository, "sessions:read")
            );

            seedRole(roleRepository, "ADMIN",   "Administrateur",       "Accès complet au système",                      adminPerms);
            seedRole(roleRepository, "PORTEUR",  "Porteur de projet",    "Porteur de projet candidatant à une session",   porteurPerms);
            seedRole(roleRepository, "JURY",     "Membre du jury",       "Évalue les candidatures lors d'une session",    juryPerms);
            seedRole(roleRepository, "MENTOR",   "Mentor",               "Accompagne les startups incubées",              mentorPerms);
            seedRole(roleRepository, "CANDIDAT", "Candidat",             "Utilisateur enregistré sans rôle attribué",     candidatPerms);

            // ── 3. Seed admin user ────────────────────────────────────────────
            if (userRepository.findByEmail("admin@medianet.tn").isEmpty()) {
                Role adminRole = roleRepository.findByName("ADMIN")
                        .orElseThrow(() -> new RuntimeException("ADMIN role not found"));

                User admin = User.builder()
                        .email("admin@medianet.tn")
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
}
