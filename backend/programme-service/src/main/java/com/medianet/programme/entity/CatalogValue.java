package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A managed option in an admin-editable reference list (taxonomy). One row per
 * value within a {@code category} — e.g. category "organization_type" or
 * "programme_sector". Frontends fetch the active values to populate dropdowns
 * instead of hard-coding them.
 */
@Entity
@Table(name = "catalog_values",
       uniqueConstraints = @UniqueConstraint(columnNames = { "category", "value" }))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CatalogValue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Taxonomy bucket, e.g. "organization_type" | "programme_sector". */
    @Column(nullable = false, length = 64)
    private String category;

    /** Stored/persisted value (what entities save). For free-text lists value == label. */
    @Column(nullable = false, length = 128)
    private String value;

    /** Human-readable label shown in the UI. */
    @Column(nullable = false, length = 128)
    private String label;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
