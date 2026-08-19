package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Coaching plan for one programme participation (one per ProgrammeParticipant).
 * Milestones are stored as a small JSON array so the plan stays flexible.
 */
@Entity
@Table(name = "coaching_plans", uniqueConstraints = @UniqueConstraint(columnNames = "participantId"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CoachingPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long participantId;

    @Column(columnDefinition = "TEXT")
    private String milestonesJson;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
