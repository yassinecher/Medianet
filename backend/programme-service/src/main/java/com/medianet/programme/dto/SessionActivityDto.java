package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SessionActivityDto {
    private Long         id;
    private Integer      activityOrder;
    private String       title;
    private String       description;
    /** Legacy type (kept for read compat — activities are now free-form). */
    private String       type;
    /** Hex color of the activity block (defaults to the session color). */
    private String       color;
    private LocalTime    startTime;
    private LocalTime    endTime;
    private String       location;
    private List<String> responsibles;
    private List<String> guests;
}
