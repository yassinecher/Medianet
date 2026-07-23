package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One line of the session update history: who changed what, from which IP, when.
 * Written on every create / update / trash / restore / purge of a session so the
 * admin can audit critical changes (dates moved, deletions…) afterwards.
 */
@Entity
@Table(name = "session_audit_logs", indexes = {
        @Index(name = "idx_audit_session",   columnList = "sessionId"),
        @Index(name = "idx_audit_programme", columnList = "programmeId"),
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SessionAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long programmeId;
    private Long sessionId;

    /** Title at the time of the action (survives a purge). */
    private String sessionTitle;

    /** CREATED · UPDATED · TRASHED · RESTORED · PURGED */
    private String action;

    /** Account (email) that performed the action — from the JWT. */
    private String userEmail;

    /** Caller IP — X-Forwarded-For (first hop) behind the gateway, else remote addr. */
    private String ipAddress;

    /** Human-readable summary of the changes, e.g. « Dates : 01/03 → 05/03 ⇒ 02/03 → 06/03 ». */
    @Column(columnDefinition = "TEXT")
    private String details;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
