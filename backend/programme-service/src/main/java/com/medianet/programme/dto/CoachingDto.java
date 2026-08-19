package com.medianet.programme.dto;

import lombok.*;
import java.util.List;

/** Coaching view for one programme participation: plan + session-note log. */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingDto {
    private CoachingPlanDto plan;
    private List<CoachingNoteDto> notes;
    /** True when the caller may edit (the participation's mentor, or an admin). */
    private boolean canEdit;
}
