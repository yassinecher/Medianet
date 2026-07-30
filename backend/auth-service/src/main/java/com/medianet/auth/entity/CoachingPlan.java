package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A mentor's coaching plan for one organisation (startup). One per organisation.
 * Milestones are stored as a small JSON array so the plan stays flexible without
 * an extra table: [{"label":"...","done":false,"dueDate":"YYYY-MM-DD"}].
 */
@Entity
@Table(name = "coaching_plans", uniqueConstraints = @UniqueConstraint(columnNames = "organizationId"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CoachingPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long organizationId;

    /** The mentor (« vis-à-vis ») who owns this plan. */
    private Long mentorUserId;

    /** JSON array of milestones — managed by the client, stored verbatim. */
    @Column(columnDefinition = "TEXT")
    private String milestonesJson;

    /** Free-text overall coaching notes / focus. */
    @Column(columnDefinition = "TEXT")
    private String notes;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
