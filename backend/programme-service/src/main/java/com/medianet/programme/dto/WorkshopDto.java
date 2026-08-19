package com.medianet.programme.dto;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkshopDto {
    private Long id;
    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseTitle;
    private String title;
    private String description;
    private String format;
    private String status;
    private LocalDate workshopDate;
    private String startTime;
    private String endTime;
    private String location;
    private String facilitator;
    private List<WorkshopTargetDto> targets;
    private LocalDateTime createdAt;
}
