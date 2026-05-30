package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * One day inside a {@link ProgrammePhase} (Session). A session can span 1..N
 * days; each day holds a list of {@link SessionActivity}.
 */
@Entity
@Table(name = "session_days")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SessionDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Parent session. {@code session_id} column references {@code programme_phases.id}
     * — the legacy table name we keep for backward compatibility.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ProgrammePhase session;

    /** 1-based index of the day within the session (Day 1, Day 2…). */
    @Column(name = "day_order")
    @Builder.Default
    private Integer dayOrder = 1;

    /** Optional label ("Kickoff", "Hackathon", "Investor day"). */
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "day_date")
    private LocalDate date;

    /** Convenience override — falls back to session location otherwise. */
    private String location;

    @OneToMany(mappedBy = "day", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("activityOrder ASC")
    @Builder.Default
    private List<SessionActivity> activities = new ArrayList<>();
}
