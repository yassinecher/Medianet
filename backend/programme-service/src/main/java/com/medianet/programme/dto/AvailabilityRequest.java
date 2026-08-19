package com.medianet.programme.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class AvailabilityRequest {
    private LocalDate slotDate;
    private String startTime;
    private String endTime;
    private String note;
}
