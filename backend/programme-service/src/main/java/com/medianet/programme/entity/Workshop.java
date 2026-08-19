package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * A workshop / atelier held for a SPECIFIC set of incubated startups within a
 * programme (optionally attached to a session/phase). Each target is a
 * participation ({@link ProgrammeParticipant}) — so the startup's assigned
 * mentor is carried automatically. Workshops surface on the shared calendar of
 * the targeted porteurs and their mentors.
 */
@Entity
@Table(name = "workshops")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Workshop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long programmeId;

    /** The session (phase) this workshop belongs to — optional. */
    private Long phaseId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Free-text kind: Atelier · Formation · Masterclass · Bootcamp · Mentorat collectif… */
    @Column(length = 40)
    @Builder.Default
    private String format = "Atelier";

    /** Lifecycle: PLANNED · DONE · CANCELLED. */
    @Column(length = 16)
    @Builder.Default
    private String status = "PLANNED";

    private LocalDate workshopDate;
    /** Free-text times, e.g. "14:00" (kept simple — no timezone gymnastics). */
    private String startTime;
    private String endTime;
    /** "Visio", a room, an address… */
    private String location;
    /** Who runs it (an expert, a mentor name…) — free text. */
    private String facilitator;

    /** The targeted participations (org × programme). Their mentors are included. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "workshop_targets", joinColumns = @JoinColumn(name = "workshop_id"))
    @Column(name = "participant_id")
    @Builder.Default
    private Set<Long> targetParticipantIds = new HashSet<>();

    private Long createdByUserId;

    @CreationTimestamp
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
