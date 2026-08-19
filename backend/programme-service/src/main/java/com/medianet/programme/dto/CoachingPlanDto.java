package com.medianet.programme.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingPlanDto {
    private String milestonesJson;
    private String notes;
    private LocalDateTime updatedAt;
}
