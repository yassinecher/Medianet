package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String firstName;
    private String lastName;

    // ── Roles (many-to-many with the roles table) ────────────────────────────

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_role_links",
        joinColumns        = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    // ── Direct permissions (beyond role-level permissions) ───────────────────

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_permission_links",
        joinColumns        = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    private Set<Permission> directPermissions = new HashSet<>();

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime createdAt;

    // ── Role-specific profiles (optional, only present if role is assigned) ──

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL,
              fetch = FetchType.LAZY, orphanRemoval = true)
    private AdminProfile adminProfile;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL,
              fetch = FetchType.LAZY, orphanRemoval = true)
    private MentorProfile mentorProfile;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL,
              fetch = FetchType.LAZY, orphanRemoval = true)
    private PorteurProfile porteurProfile;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL,
              fetch = FetchType.LAZY, orphanRemoval = true)
    private JuryProfile juryProfile;

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (roles == null) roles = new HashSet<>();
        if (directPermissions == null) directPermissions = new HashSet<>();
    }

    @PostLoad
    protected void initCollections() {
        if (roles == null) roles = new HashSet<>();
        if (directPermissions == null) directPermissions = new HashSet<>();
    }

    // ── Convenience helpers ──────────────────────────────────────────────────

    /** All role name strings, e.g. {"ADMIN", "PORTEUR"} */
    public Set<String> getRoleNames() {
        if (roles == null) return new HashSet<>();
        return roles.stream().map(Role::getName).collect(Collectors.toSet());
    }

    /**
     * All effective permission slugs = direct permissions UNION all role permissions.
     * This is what gets embedded in the JWT.
     */
    public Set<String> getAllPermissionSlugs() {
        Set<String> all = new HashSet<>();
        if (directPermissions != null) {
            directPermissions.forEach(p -> all.add(p.getSlug()));
        }
        if (roles != null) {
            roles.forEach(r -> {
                if (r.getPermissions() != null) {
                    r.getPermissions().forEach(p -> all.add(p.getSlug()));
                }
            });
        }
        return all;
    }

    /** Direct permission slugs only (no role-inherited ones) */
    public Set<String> getDirectPermissionSlugs() {
        if (directPermissions == null) return new HashSet<>();
        return directPermissions.stream().map(Permission::getSlug).collect(Collectors.toSet());
    }

    /** Primary role name for backward compatibility (first alphabetically) */
    public String getPrimaryRole() {
        return getRoleNames().stream().sorted().findFirst().orElse("CANDIDAT");
    }

    public boolean hasRole(String roleName) {
        return getRoleNames().contains(roleName.toUpperCase());
    }

    public boolean hasPermission(String slug) {
        return getAllPermissionSlugs().contains(slug);
    }
}
