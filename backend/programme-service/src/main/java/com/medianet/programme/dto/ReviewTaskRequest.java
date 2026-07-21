package com.medianet.programme.dto;

import lombok.Data;

/** Admin/mentor reviews a submitted task: approve → COMPLETED, else → back to IN_PROGRESS. */
@Data
public class ReviewTaskRequest {
    /** true = accept the deliverable (COMPLETED); false = request changes (IN_PROGRESS). */
    private boolean approve;
    /** Feedback shown to the assignee — especially when changes are requested. */
    private String reviewNote;
}
