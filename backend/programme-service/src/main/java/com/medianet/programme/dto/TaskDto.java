package com.medianet.programme.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

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
    private LocalDate dueDate;
    private String priority;
    private String status;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
