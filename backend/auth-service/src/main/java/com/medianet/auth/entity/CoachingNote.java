package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A single coaching / mentoring session note attached to an organisation.
 * Many per organisation — a running log the mentor keeps after each meeting.
 */
@Entity
@Table(name = "coaching_notes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CoachingNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long organizationId;

    private Long authorUserId;
    /** Denormalised author name so the note reads without a user lookup. */
    private String authorName;

    private LocalDate sessionDate;
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String nextSteps;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
