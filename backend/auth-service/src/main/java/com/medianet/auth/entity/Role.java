package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

/**
 * A system role (e.g. ADMIN, PORTEUR, JURY, MENTOR, CANDIDAT).
 * Each role carries a set of default permissions and a human-readable profile.
 */
@Entity
@Table(name = "roles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Canonical name — always upper-case: ADMIN | PORTEUR | JURY | MENTOR | CANDIDAT */
    @Column(unique = true, nullable = false)
    private String name;

    /** Human-readable label, e.g. "Porteur de projet" */
    @Column(nullable = false)
    private String displayName;

    private String description;

    /** Permissions included in this role by default */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "role_permission_links",
        joinColumns        = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    private Set<Permission> permissions = new HashSet<>();

    @ManyToMany(mappedBy = "roles", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<User> users = new HashSet<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Role r)) return false;
        return name != null && name.equals(r.name);
    }

    @Override
    public int hashCode() {
        return name == null ? 0 : name.hashCode();
    }
}
