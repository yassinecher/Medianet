package com.medianet.auth.dto;

import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingNoteDto {
    private Long id;
    private Long authorUserId;
    private String authorName;
    private LocalDate sessionDate;
    private String title;
    private String content;
    private String nextSteps;
    private LocalDateTime createdAt;
}
