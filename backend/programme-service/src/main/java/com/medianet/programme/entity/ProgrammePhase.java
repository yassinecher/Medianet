package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A phase / Session within a Programme. The table is kept under the legacy
 * name {@code programme_phases} for backward-compatibility, but semantically
 * this is the unified <b>Session</b> entity — its {@link #sessionType} marks
 * what kind of session it is (candidature submission, preselection, pitch
 * day, onboarding, incubation, demo day or training day).
 */
@Entity
@Table(name = "programme_phases")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProgrammePhase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programme_id", nullable = false)
    private Programme programme;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Display order within the programme timeline. */
    @Column(name = "phase_order")
    @Builder.Default
    private Integer phaseOrder = 0;

    private LocalDate startDate;
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PhaseStatus status = PhaseStatus.UPCOMING;

    /**
     * Discriminator for the unified Session model. Defaults to INCUBATION so
     * legacy rows (created before this column existed) keep working.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "session_type", length = 32)
    @Builder.Default
    private SessionType sessionType = SessionType.INCUBATION;

    /**
     * Swimlane/track this session belongs to on the Parcours timeline.
     * Free-text — sessions sharing the same lane render on the same row
     * (e.g. "Cohorte A" vs "Cohorte B" vs "Tech track").
     * Defaults to "Principal" when nothing is specified.
     */
    @Column(name = "lane", length = 64)
    @Builder.Default
    private String lane = "Principal";

    /**
     * IDs of ProgrammeCriteria that this phase focuses on.
     * Empty = all programme criteria apply.
     */
    @ElementCollection
    @CollectionTable(
        name = "phase_focus_criteria",
        joinColumns = @JoinColumn(name = "phase_id")
    )
    @Column(name = "criteria_id")
    @Builder.Default
    private List<Long> focusCriteriaIds = new ArrayList<>();

    // ── Session-style fields (added for the visual builder) ───────────────────

    /** Where it happens — venue, address, or "Online". */
    @Column(name = "location")
    private String location;

    /**
     * Logical duration: "day" (single day), "week" (multi-day), or "custom".
     * Drives the Timeline visual rendering.
     */
    @Column(name = "duration_kind", length = 16)
    @Builder.Default
    private String durationKind = "day";

    /** People responsible for running this session (emails or names). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "phase_responsibles", joinColumns = @JoinColumn(name = "phase_id"))
    @Column(name = "responsible")
    @Builder.Default
    private List<String> responsibles = new ArrayList<>();

    /** External guests / speakers invited. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "phase_guests", joinColumns = @JoinColumn(name = "phase_id"))
    @Column(name = "guest")
    @Builder.Default
    private List<String> guests = new ArrayList<>();

    /** Candidature ids of the startups expected to attend this session. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "phase_startups", joinColumns = @JoinColumn(name = "phase_id"))
    @Column(name = "startup_id")
    @Builder.Default
    private List<Long> startupIds = new ArrayList<>();

    /** Checklist of tasks to prepare/run this session. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "phase_tasks", joinColumns = @JoinColumn(name = "phase_id"))
    @OrderColumn(name = "task_order")
    @Builder.Default
    private List<PhaseTask> tasks = new ArrayList<>();

    /**
     * Per-criterion weight specific to THIS session (0.0–1.0).
     * Stored as JSON map {criterionId: weight} in a single TEXT column for
     * simplicity — Map<Long, Double> in JPA is awkward across providers.
     * The frontend serializes/deserializes this transparently.
     */
    @Column(name = "criterion_weights_json", columnDefinition = "TEXT")
    private String criterionWeightsJson;

    /** Days that make up this session (1..N). Lazy-loaded by default. */
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOrder ASC")
    @Builder.Default
    private List<SessionDay> days = new ArrayList<>();
}
