package com.medianet.programme.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingReviewDto {
    private Long id;
    private Long authorUserId;
    private String authorName;
    private String authorRole;
    private String targetType;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
}
