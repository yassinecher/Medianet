package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalTime;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateSessionActivityRequest {
    private Integer      activityOrder;
    private String       title;
    private String       description;
    private String       type;
    /** Optional — change the activity block color (hex). */
    private String       color;
    private LocalTime    startTime;
    private LocalTime    endTime;
    private String       location;
    private List<String> responsibles;
    private List<String> guests;
}
