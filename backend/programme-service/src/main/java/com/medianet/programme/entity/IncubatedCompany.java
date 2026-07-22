package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A company already incubated by Medianet — the admin-managed alumni catalogue
 * shown on the public « Sociétés incubées » page of the frontoffice.
 */
@Entity
@Table(name = "incubated_companies")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class IncubatedCompany {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String website;
    private String sector;
    /** Cohorte / année d'incubation, e.g. "2024". */
    private String cohortYear;

    /** Null-safe visibility flag (null = hidden from the public page). */
    private Boolean publicVisible;

    /** Manual ordering on the public page (lower first). */
    private Integer sortOrder;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
