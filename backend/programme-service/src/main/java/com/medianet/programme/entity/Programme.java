package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.List;

/**
 * An incubation programme — replaces the old Session concept.
 * A Programme contains criteria (scoring) and phases (timeline).
 */
@Entity
@Table(name = "programmes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Programme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProgrammeType type = ProgrammeType.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProgrammeStatus status = ProgrammeStatus.DRAFT;

    /**
     * Which formulaire layout porteurs see on /candidater.
     * Defaults to STANDARD (all 4 sections from the DOCX).
     * Ignored if {@link #customFormSchema} is set.
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FormTemplate formTemplate = FormTemplate.STANDARD;

    /**
     * Optional custom form schema (JSON). When non-null/non-blank, the
     * frontoffice renders this dynamic schema instead of {@link #formTemplate}.
     *
     * <p>Shape (validated client-side):
     * <pre>
     * { "sections": [
     *     { "key": "...", "title": "...", "description": "...",
     *       "fields": [
     *         { "key": "...", "label": "...", "type": "text|textarea|email|tel|url|number|select|radio|checkbox",
     *           "placeholder": "...", "required": true, "options": ["..."], "helpText": "..." }
     *       ]
     *     }
     *   ]
     * }
     * </pre>
     */
    @Column(columnDefinition = "TEXT")
    private String customFormSchema;

    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate applicationDeadline;

    /** Max number of applications accepted (null = unlimited). */
    private Integer maxApplications;

    /** Sectors / domains this programme targets (e.g. Tech, Agri, Finance). */
    @ElementCollection
    @CollectionTable(name = "programme_sectors", joinColumns = @JoinColumn(name = "programme_id"))
    @Column(name = "sector")
    @Builder.Default
    private List<String> sectors = new ArrayList<>();

    /**
     * Organisation types eligible to apply (catalogue "organization_type" values,
     * e.g. STARTUP, UNIVERSITY). Empty = all types are eligible.
     */
    @ElementCollection
    @CollectionTable(name = "programme_eligible_org_types", joinColumns = @JoinColumn(name = "programme_id"))
    @Column(name = "org_type")
    @Builder.Default
    private List<String> eligibleOrgTypes = new ArrayList<>();

    // ── Rich presentation fields ───────────────────────────────────────────

    /** Short catchphrase / subtitle shown on the hero (e.g. "The FoodTech Program"). */
    private String tagline;

    /** URL of the programme's own logo. */
    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    /** URL of a wide hero / banner image. */
    @Column(columnDefinition = "TEXT")
    private String bannerImageUrl;

    /** City or venue name. */
    private String location;

    /** External application URL (e.g. Typeform link). Null = use internal form. */
    @Column(columnDefinition = "TEXT")
    private String applicationUrl;

    // ── Key stats (shown as impact numbers) ───────────────────────────────
    private Integer expertCount;
    private Integer trainingSessionsCount;
    private Integer mentoringHoursPerMonth;
    private Integer maxStartups;

    // ── Structured lists ──────────────────────────────────────────────────
    @ElementCollection
    @CollectionTable(name = "programme_objectives", joinColumns = @JoinColumn(name = "programme_id"))
    @Column(name = "objective", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> objectives = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "programme_benefits", joinColumns = @JoinColumn(name = "programme_id"))
    @Column(name = "benefit", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> benefits = new ArrayList<>();

    /** Admin who created this programme (denormalized from JWT). */
    private Long   createdByAdminId;
    private String createdByAdminName;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ── Relationships ──────────────────────────────────────────────────────

    @OneToMany(mappedBy = "programme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("criterionOrder ASC")
    @Builder.Default
    private List<ProgrammeCriteria> criteria = new ArrayList<>();

    @OneToMany(mappedBy = "programme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("phaseOrder ASC")
    @Builder.Default
    private List<ProgrammePhase> phases = new ArrayList<>();

    @ManyToMany
    @JoinTable(
        name = "programme_partners",
        joinColumns = @JoinColumn(name = "programme_id"),
        inverseJoinColumns = @JoinColumn(name = "partner_id")
    )
    @Builder.Default
    private List<Partner> partners = new ArrayList<>();
}
