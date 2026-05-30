package com.medianet.adminai.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Audit log entry — one row per AI-proposed mutation.
 *
 * <p>Lifecycle:
 * <ol>
 *   <li><b>PENDING</b> — Claude proposed the action; admin must confirm.</li>
 *   <li><b>EXECUTED</b> — Admin confirmed, action ran successfully.</li>
 *   <li><b>FAILED</b> — Execution failed (server error, validation, etc.).</li>
 *   <li><b>REVERTED</b> — Admin clicked "Annuler" — the inverse operation ran.</li>
 *   <li><b>CANCELLED</b> — Admin declined the proposal before execution.</li>
 * </ol>
 */
@Entity
@Table(name = "admin_actions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Conversation the action belongs to. */
    private Long conversationId;

    /** Tool name as exposed to Claude (e.g. "create_programme", "send_email"). */
    @Column(nullable = false)
    private String tool;

    /** Human-readable title shown in the audit UI. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    /** Plain-French explanation of what will happen. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** JSON of the tool arguments as proposed by Claude. */
    @Column(columnDefinition = "TEXT")
    private String argsJson;

    /** JSON capturing the "before" state — used to undo. */
    @Column(columnDefinition = "TEXT")
    private String beforeStateJson;

    /** JSON returned from the upstream service after execution. */
    @Column(columnDefinition = "TEXT")
    private String resultJson;

    /** Stored error if execution or revert failed. */
    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ActionStatus status = ActionStatus.PENDING;

    /** Admin who initiated the chat / approved the action. */
    private Long adminId;
    private String adminName;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime executedAt;
    private LocalDateTime revertedAt;
}
