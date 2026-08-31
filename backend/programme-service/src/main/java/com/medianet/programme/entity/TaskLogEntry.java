package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.time.LocalDateTime;

/** One append-only entry in a task's activity log (who did what, when). */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskLogEntry {
    private Long actorUserId;
    private String actorName;
    /** CREATED · ASSIGNED · STARTED · STEP_ADDED · STEP_DONE · STEP_REOPENED ·
     *  FILE_ADDED · SUBMITTED · APPROVED · REVISION_REQUESTED · STATUS · COMMENT · COLLABORATOR */
    @Column(length = 24)
    private String action;
    @Column(columnDefinition = "TEXT")
    private String note;
    private LocalDateTime at;
}
