package com.medianet.programme.dto;

import lombok.Data;

/** The assignee submits their deliverable (rendu) — moves the task to SUBMITTED. */
@Data
public class SubmitTaskRequest {
    /** Written result / notes describing what was done. */
    private String submissionText;
    /** Optional link or file URL for the deliverable. */
    private String submissionUrl;
}
