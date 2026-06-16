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
    /** Legacy type (optional — activities are free-form now). */
    private String       type;
    /** Hex color of the activity block (optional; defaults to session color). */
    private String       color;
    private LocalTime    startTime;
    private LocalTime    endTime;
    private String       location;
    private List<String> responsibles;
    private List<String> guests;
}
