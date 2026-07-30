package com.medianet.auth.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class CoachingNoteRequest {
    private LocalDate sessionDate;
    private String title;
    private String content;
    private String nextSteps;
}
