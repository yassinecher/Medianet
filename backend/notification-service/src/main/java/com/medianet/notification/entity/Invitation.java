package com.medianet.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invitations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique token embedded in the Accept/Decline email links */
    @Column(nullable = false, unique = true)
    @Builder.Default
    private String token = UUID.randomUUID().toString();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvitationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private InvitationStatus status = InvitationStatus.PENDING;

    // ── Context ───────────────────────────────────────────────────────────────
    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;
    /** Optional activity (within a session/day) this invite is for. */
    private Long activityId;
    private String activityName;

    // ── Recipient ─────────────────────────────────────────────────────────────
    @Column(nullable = false)
    private String recipientEmail;

    private String recipientName;

    // ── Content ───────────────────────────────────────────────────────────────
    @Column(nullable = false)
    private String subject;

    @Column(columnDefinition = "TEXT")
    private String message;

    /** True when the invitation includes Accept/Decline RSVP links */
    @Builder.Default
    private Boolean requiresRsvp = false;

    // ── Sender (admin who triggered the invite) ───────────────────────────────
    private Long sentByAdminId;
    private String sentByAdminName;

    // ── Tracking ──────────────────────────────────────────────────────────────
    private LocalDateTime sentAt;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
