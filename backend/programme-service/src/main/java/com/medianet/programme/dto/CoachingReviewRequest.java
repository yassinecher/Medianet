package com.medianet.programme.dto;

import lombok.Data;

@Data
public class CoachingReviewRequest {
    private String targetType;
    private Integer rating;
    private String comment;
}
