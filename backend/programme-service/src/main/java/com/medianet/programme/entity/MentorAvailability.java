package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A one-off availability slot published by a mentor — a window when they are
 * free for a coaching rendez-vous. A porteur they accompany can book an open
 * slot, which marks it booked and creates an (accepted) coaching meeting.
 */
@Entity
@Table(name = "mentor_availability")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MentorAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mentorUserId;

    private LocalDate slotDate;
    /** Free-text times, e.g. "14:00" (kept simple — no timezone gymnastics). */
    private String startTime;
    private String endTime;
    private String note;

    @Column(nullable = false)
    @Builder.Default
    private boolean booked = false;

    /** The participation that booked this slot (null while open). */
    private Long bookedByParticipantId;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
