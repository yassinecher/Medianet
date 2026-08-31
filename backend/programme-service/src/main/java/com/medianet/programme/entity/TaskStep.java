package com.medianet.programme.entity;

import jakarta.persistence.Embeddable;
import lombok.*;
import java.time.LocalDateTime;

/** A checklist sub-step of a task (like an Asana/Trello checklist item). */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskStep {
    private String code;
    private String title;
    private boolean done;
    private String doneByName;
    private LocalDateTime doneAt;
    private LocalDateTime createdAt;
}
