package com.medianet.programme.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class CoachingMeetingRequest {
    private LocalDate proposedDate;
    private String proposedTime;
    private String location;
    private String note;
}
