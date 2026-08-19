package com.medianet.programme.dto;

import lombok.*;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AvailabilityDto {
    private Long id;
    private Long mentorUserId;
    private LocalDate slotDate;
    private String startTime;
    private String endTime;
    private String note;
    private boolean booked;
    private Long bookedByParticipantId;
}
