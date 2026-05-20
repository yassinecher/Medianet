package com.medianet.session.dto;

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
public class SessionDto {
    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate submissionDeadline;
    private String status;
    private Integer maxProjects;
    private Long createdByAdminId;
    private String createdByAdminName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
