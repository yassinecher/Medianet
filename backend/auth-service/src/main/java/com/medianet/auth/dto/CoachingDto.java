package com.medianet.auth.dto;

import lombok.*;

import java.util.List;

/** The full coaching view for one organisation: the plan + the session-note log. */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CoachingDto {
    private CoachingPlanDto plan;
    private List<CoachingNoteDto> notes;
    /** True when the caller may edit (the assigned mentor, or an admin). */
    private boolean canEdit;
}
