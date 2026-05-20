package com.medianet.auth.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MentorProfileDto {
    private Long id;
    private String title;
    private String bio;
    private List<String> expertise;
    private List<String> specializations;
    private Double rating;
    private String availability;
    private String linkedInUrl;
    private String website;
    private Integer yearsOfExperience;
    private Integer sessionCount;
}
