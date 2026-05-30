package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One agenda item inside a {@link SessionDay}.
 *
 * <p>Holds the timing, responsible people, invited guests and an optional
 * activity type so the UI can render formation steps and event activities
 * with the same shape.
 */
@Entity
@Table(name = "session_activities")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SessionActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_day_id", nullable = false)
    private SessionDay day;

    @Column(name = "activity_order")
    @Builder.Default
    private Integer activityOrder = 0;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", length = 32)
    @Builder.Default
    private ActivityType type = ActivityType.ACTIVITY;

    /** When the activity starts (within the day). */
    @Column(name = "start_time")
    private LocalTime startTime;

    /** When the activity ends (within the day). */
    @Column(name = "end_time")
    private LocalTime endTime;

    /** Where it physically happens — room, link, "Online", etc. */
    private String location;

    /** Free-form responsible people (emails, names, "Mentor X"). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "session_activity_responsibles",
            joinColumns = @JoinColumn(name = "activity_id"))
    @Column(name = "responsible")
    @Builder.Default
    private List<String> responsibles = new ArrayList<>();

    /** Invited guests (internal or external — just labels). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "session_activity_guests",
            joinColumns = @JoinColumn(name = "activity_id"))
    @Column(name = "guest")
    @Builder.Default
    private List<String> guests = new ArrayList<>();
}
