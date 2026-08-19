package com.medianet.programme.dto;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingMeetingDto {
    private Long id;
    private Long participantId;
    private LocalDate proposedDate;
    private String proposedTime;
    private String location;
    private String note;
    private Long requestedByUserId;
    private String requestedByName;
    private String status;
    private LocalDateTime createdAt;
    // Enriched (for calendars / cross-participation lists):
    private Long programmeId;
    private String programmeName;
    private Long organizationId;
    private String organizationName;
}
