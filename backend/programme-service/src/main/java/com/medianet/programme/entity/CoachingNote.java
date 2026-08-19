package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** A coaching / mentoring session note for one programme participation. */
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
    private Long participantId;

    private Long authorUserId;
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
