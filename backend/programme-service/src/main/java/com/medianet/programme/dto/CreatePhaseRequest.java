package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import com.medianet.programme.entity.PhaseTask;
import java.time.LocalDate;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreatePhaseRequest {

    @NotBlank(message = "Phase title is required")
    private String title;

    private String    description;
    private Integer   phaseOrder = 0;
    private LocalDate startDate;
    private LocalDate endDate;

    /** IDs of ProgrammeCriteria this phase focuses on (empty = all). */
    private List<Long> focusCriteriaIds;

    // ── Session fields (visual builder) ──────────────────────────────────────
    private String          location;
    private String          durationKind;          // "day" | "range" (legacy: week/custom -> range)
    private List<String>    responsibles;
    private List<String>    guests;
    private List<Long>      startupIds;
    private List<PhaseTask> tasks;
    /** JSON map criterionId(string) → weight(0..1). */
    private String          criterionWeightsJson;
    /** Évaluation sessions: saved candidature-selection (shortlist) to evaluate. */
    private Long            evaluationSelectionId;

    /** Session type (CANDIDATURE_SUBMISSION, PITCH_DAY, TRAINING_DAY, …). */
    private String          sessionType;

    /** Swimlane (e.g. "Principal", "Cohorte A"). Defaults to "Principal". */
    private String          lane;

    /** Hex color of the session bar (inherited from the preset). */
    private String          color;

    /** Optional parent (range) session id — set when creating a nested day-session. */
    private Long            parentSessionId;

    /** Optional initial days for the session. */
    private List<CreateSessionDayRequest> days;
}
