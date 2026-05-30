package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateTaskRequest {

    /**
     * Programme this task belongs to.
     * <p>Required when posting to <code>/api/tasks</code> (the body carries it);
     * ignored when posting to <code>/api/programmes/{programmeId}/tasks</code>
     * because it's already in the path.
     */
    private Long programmeId;

    /** Phase within the programme (optional — null means whole programme) */
    private Long phaseId;
    private String phaseName;

    @NotNull(message = "assignedToUserId is required")
    private Long assignedToUserId;

    private String assignedToEmail;
    private String assignedToName;

    @NotBlank(message = "title is required")
    private String title;

    private String description;
    private LocalDate dueDate;

    /** LOW | MEDIUM | HIGH | URGENT — defaults to MEDIUM */
    private String priority;
}
