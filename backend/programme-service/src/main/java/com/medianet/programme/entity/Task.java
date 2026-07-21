package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
@SQLRestriction("deleted_at is null")   // soft-deleted (trashed) tasks are hidden from every query
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Context (both nullable — task can be standalone or scoped) ────────────
    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;

    // ── Assignment ────────────────────────────────────────────────────────────
    /** The porteur or team member who must do this task */
    @Column(nullable = false)
    private Long assignedToUserId;
    private String assignedToEmail;
    private String assignedToName;

    /** The admin or mentor who created the task */
    @Column(nullable = false)
    private Long assignedByUserId;
    private String assignedByName;

    // ── Content ───────────────────────────────────────────────────────────────
    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** What the assignee must deliver (the "rendu") — set by the admin/mentor. */
    @Column(columnDefinition = "TEXT")
    private String expectedDeliverable;

    private LocalDate dueDate;

    // ── Deliverable / submission (the assignee's result) ──────────────────────
    /** The assignee's written result / notes. */
    @Column(columnDefinition = "TEXT")
    private String submissionText;

    /** Optional link or file URL the assignee submits as the deliverable. */
    private String submissionUrl;

    /** When the assignee submitted (status → SUBMITTED). */
    private LocalDateTime submittedAt;

    /** Admin/mentor feedback — filled when a submission is sent back for revision. */
    @Column(columnDefinition = "TEXT")
    private String reviewNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TaskStatus status = TaskStatus.PENDING;

    private LocalDateTime completedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /** Soft-delete timestamp — non-null means the task is in the trash. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
