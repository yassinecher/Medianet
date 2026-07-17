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

    /** Canonical name — always upper-case: ADMIN | PORTEUR | JURY | MENTOR | CANDIDAT | custom */
    @Column(unique = true, nullable = false)
    private String name;

    /** Human-readable label, e.g. "Porteur de projet" */
    @Column(nullable = false)
    private String displayName;

    private String description;

    /**
     * Built-in roles (seeded at boot) cannot be renamed or deleted; admin-created
     * roles are fully editable. ADMIN additionally always holds every permission.
     */
    // columnDefinition carries a SQL default so ddl-auto:update can add the
    // column to the existing populated table.
    @Column(name = "system_role", nullable = false, columnDefinition = "boolean not null default false")
    @Builder.Default
    private boolean systemRole = false;

    /** Permissions OWNED by this role (excluding inherited ones) */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "role_permission_links",
        joinColumns        = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    private Set<Permission> permissions = new HashSet<>();

    /**
     * Optional parent role: this role inherits every permission of its parent
     * (and transitively of all ancestors). Live: editing the parent's
     * permissions immediately changes the child's effective set.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "parent_role_id")
    private Role parent;

    @ManyToMany(mappedBy = "roles", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<User> users = new HashSet<>();

    /**
     * Effective permissions: own + every ancestor's, walking the parent chain.
     * Cycle-safe (visited set) even though the service layer forbids cycles.
     */
    public Set<Permission> getEffectivePermissions() {
        Set<Permission> out = new HashSet<>();
        Set<Long> visited = new HashSet<>();
        Role cursor = this;
        while (cursor != null && cursor.getId() != null && visited.add(cursor.getId())) {
            if (cursor.getPermissions() != null) out.addAll(cursor.getPermissions());
            cursor = cursor.getParent();
        }
        return out;
    }

    /** Permissions coming ONLY from ancestors (not owned by this role). */
    public Set<Permission> getInheritedPermissions() {
        Set<Permission> inherited = getEffectivePermissions();
        if (permissions != null) inherited.removeAll(permissions);
        return inherited;
    }

    /** Whether {@code candidate} is this role or one of its ancestors. */
    public boolean hasAncestorOrSelf(Role candidate) {
        Set<Long> visited = new HashSet<>();
        Role cursor = this;
        while (cursor != null && cursor.getId() != null && visited.add(cursor.getId())) {
            if (cursor.getId().equals(candidate.getId())) return true;
            cursor = cursor.getParent();
        }
        return false;
    }

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
