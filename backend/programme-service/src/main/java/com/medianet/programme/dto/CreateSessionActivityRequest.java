package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalTime;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateSessionActivityRequest {
    private Integer activityOrder;
    @NotBlank private String title;
    private String       description;
    /** ACTIVITY | TRAINING_STEP | KEYNOTE | WORKSHOP | PANEL | PITCH | BREAK | NETWORKING | OTHER */
    private String       type;
    private LocalTime    startTime;
    private LocalTime    endTime;
    private String       location;
    private List<String> responsibles;
    private List<String> guests;
}
