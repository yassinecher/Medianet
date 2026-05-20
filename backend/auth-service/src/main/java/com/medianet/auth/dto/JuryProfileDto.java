package com.medianet.auth.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class JuryProfileDto {
    private Long id;
    private String title;
    private String bio;
    private String affiliation;
    private List<String> expertise;
    private String linkedInUrl;
    private Integer evaluationCount;
    private Double averageScore;
}
