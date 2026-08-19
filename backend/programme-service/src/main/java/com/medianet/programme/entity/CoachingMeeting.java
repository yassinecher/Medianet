package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A mentoring meeting request between the mentor and the porteur of one
 * participation. Either side can request one; the other accepts/declines.
 * Accepted meetings surface on both people's shared calendars.
 */
@Entity
@Table(name = "coaching_meetings")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CoachingMeeting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long participantId;

    private LocalDate proposedDate;
    /** Free-text time, e.g. "14:00" (kept simple — no timezone gymnastics). */
    private String proposedTime;
    /** "Visio", a room, an address… */
    private String location;

    @Column(columnDefinition = "TEXT")
    private String note;

    private Long requestedByUserId;
    private String requestedByName;

    /** PENDING · ACCEPTED · DECLINED · CANCELLED. */
    @Column(length = 16)
    @Builder.Default
    private String status = "PENDING";

    @CreationTimestamp
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
