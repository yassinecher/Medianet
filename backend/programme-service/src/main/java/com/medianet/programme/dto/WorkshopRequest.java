package com.medianet.programme.dto;

import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class WorkshopRequest {
    private Long phaseId;
    private String title;
    private String description;
    private String format;
    private String status;
    private LocalDate workshopDate;
    private String startTime;
    private String endTime;
    private String location;
    private String facilitator;
    /** The targeted participations (org × programme) — their mentors are auto-included. */
    private List<Long> targetParticipantIds;
}
