package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/** A review/feedback on a participation, written by its mentor, porteur or a member. */
@Entity
@Table(name = "coaching_reviews")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CoachingReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long participantId;

    private Long authorUserId;
    private String authorName;
    /** MENTOR · PORTEUR · MEMBER · ADMIN (derived from the author). */
    @Column(length = 16)
    private String authorRole;
    /** What is reviewed: STARTUP · MENTOR · PROGRAMME. */
    @Column(length = 16)
    private String targetType;

    private Integer rating; // 1..5

    @Column(columnDefinition = "TEXT")
    private String comment;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
