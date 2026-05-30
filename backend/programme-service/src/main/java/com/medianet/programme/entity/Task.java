package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
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

    private LocalDate dueDate;

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
}
