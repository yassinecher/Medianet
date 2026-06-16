package com.medianet.programme.dto;

import lombok.*;

import com.medianet.programme.entity.PhaseTask;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProgrammePhaseDto {
    private Long        id;
    private String      title;
    private String      description;
    private Integer     phaseOrder;
    private LocalDate   startDate;
    private LocalDate   endDate;
    private String      status;
    private List<Long>  focusCriteriaIds;

    // Session fields
    private String          location;
    private String          durationKind;
    private List<String>    responsibles;
    private List<String>    guests;
    private List<Long>      startupIds;
    private List<PhaseTask> tasks;
    private String          criterionWeightsJson;

    /** SessionType — one of CANDIDATURE_SUBMISSION, PRESELECTION, PITCH_DAY,
     *  ONBOARDING, INCUBATION, DEMO_DAY, TRAINING_DAY. */
    private String          sessionType;

    /** Swimlane (e.g. "Principal", "Cohorte A") — drives row grouping on the timeline. */
    private String          lane;

    /** Hex color of the session bar — first-class (sessions are type-free). */
    private String          color;

    /** Parent (range) session this day-session nests inside; null = top-level. */
    private Long            parentSessionId;

    /** Évaluation sessions: saved candidature-selection (shortlist) the jury
     *  evaluates; null = all candidatures. */
    private Long            evaluationSelectionId;

    /** Days that make up this session (1..N). */
    private List<SessionDayDto> days;
}
