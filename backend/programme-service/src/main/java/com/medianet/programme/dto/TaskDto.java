package com.medianet.programme.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskDto {
    private Long id;
    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;
    private Long assignedToUserId;
    private String assignedToEmail;
    private String assignedToName;
    private Long assignedByUserId;
    private String assignedByName;
    private String title;
    private String description;
    private String expectedDeliverable;
    private LocalDate dueDate;
    private String priority;
    private String status;
    private String submissionText;
    private String submissionUrl;
    private LocalDateTime submittedAt;
    private String reviewNote;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ── Rich model ─────────────────────────────────────────────────────────
    private List<Attachment> attachments;
    private List<Step> steps;
    private List<Collaborator> collaborators;
    /** Present only on the single-task detail fetch. */
    private List<LogEntry> activityLog;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Attachment {
        private String code;
        private String kind;   // RESOURCE · SUBMISSION
        private String url;
        private String name;
        private Long sizeBytes;
        private String contentType;
        private Long uploadedByUserId;
        private String uploadedByName;
        private LocalDateTime createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Step {
        private String code;
        private String title;
        private boolean done;
        private String doneByName;
        private LocalDateTime doneAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Collaborator {
        private Long userId;
        private String name;
        private String role;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LogEntry {
        private Long actorUserId;
        private String actorName;
        private String action;
        private String note;
        private LocalDateTime at;
    }
}
