package com.medianet.programme.entity;

import jakarta.persistence.Embeddable;
import lombok.*;

/** An extra actor on a task (beyond the primary assignee) — a team member or a
 *  mentor who can view, work the checklist and add deliverables. */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskCollaborator {
    private Long userId;
    private String name;
    /** Free role label: MEMBER · MENTOR · REVIEWER … */
    private String role;
}
