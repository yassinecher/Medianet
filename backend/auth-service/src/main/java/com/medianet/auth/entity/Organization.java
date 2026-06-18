package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Organisation owned, run or sponsored by users of the platform.
 *
 * <p>Generalises the older {@link Company}: a porteur can attach an
 * Organization (their startup) when submitting a candidature; the incubator
 * itself, partners, universities and sponsors are also Organizations.
 * Members are people associated with the org — they may or may not have a
 * platform account.
 */
@Entity
@Table(name = "organizations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /**
     * Organisation type — a free string backed by the admin-managed
     * "organization_type" catalogue (was an enum; the column is already VARCHAR,
     * so this is a non-destructive change). Defaults to "STARTUP".
     */
    @Column(name = "org_type", length = 32)
    @Builder.Default
    private String type = "STARTUP";

    @Column(columnDefinition = "TEXT")
    private String description;

    private String sector;
    private String city;
    private String country;
    /** Street address — also used to render the map on the org profile. */
    private String address;
    private String website;
    private String contactEmail;
    private String contactPhone;

    /** Extra profile details. */
    private Integer foundedYear;
    /** Employee-count range, e.g. "1-10", "11-50". */
    private String employeeCount;

    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    /**
     * Whether this organisation is internal to the incubator (own team,
     * mentors network) or external (sponsor, partner, applicant startup).
     */
    @Builder.Default
    private Boolean internal = false;

    /** User who registered this organisation (porteur, admin, mentor…). */
    private Long createdByUserId;

    /** Optional bridge to the legacy {@link Company} record (during migration). */
    private Long linkedCompanyId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrganizationMember> members = new ArrayList<>();
}
