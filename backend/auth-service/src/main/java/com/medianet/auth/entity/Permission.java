package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

/**
 * A system permission (e.g. "candidatures:evaluate").
 * Permissions belong to Roles and can also be granted directly to Users.
 */
@Entity
@Table(name = "permissions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Machine-readable slug, e.g. "users:read" */
    @Column(unique = true, nullable = false)
    private String slug;

    /** Human-readable label, e.g. "Voir les utilisateurs" */
    @Column(nullable = false)
    private String displayName;

    private String description;

    /** Grouping category: users | sessions | candidatures | reports */
    private String category;

    @ManyToMany(mappedBy = "permissions", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @ManyToMany(mappedBy = "directPermissions", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<User> users = new HashSet<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Permission p)) return false;
        return slug != null && slug.equals(p.slug);
    }

    @Override
    public int hashCode() {
        return slug == null ? 0 : slug.hashCode();
    }
}
