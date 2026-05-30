package com.medianet.programme.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateTaskRequest {
    private String title;
    private String description;
    private LocalDate dueDate;
    private String priority;
    private String status;
    private Long assignedToUserId;
    private String assignedToEmail;
    private String assignedToName;
    private Long phaseId;
    private String phaseName;
}
