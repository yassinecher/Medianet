package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

/**
 * Tiny embedded task that belongs to a ProgrammePhase (session).
 * Shown as a checklist in the session inspector.
 */
@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PhaseTask {
    @Column(name = "task_title")
    private String title;

    /** Optional — admin or speaker assigned to do this task. */
    @Column(name = "task_assignee")
    private String assignee;

    @Column(name = "task_done")
    @Builder.Default
    private Boolean done = false;
}
