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
    private String          durationKind;          // "day" | "week" | "custom"
    private List<String>    responsibles;
    private List<String>    guests;
    private List<Long>      startupIds;
    private List<PhaseTask> tasks;
    /** JSON map criterionId(string) → weight(0..1). */
    private String          criterionWeightsJson;

    /** Session type (CANDIDATURE_SUBMISSION, PITCH_DAY, TRAINING_DAY, …). */
    private String          sessionType;

    /** Swimlane (e.g. "Principal", "Cohorte A"). Defaults to "Principal". */
    private String          lane;

    /** Optional initial days for the session. */
    private List<CreateSessionDayRequest> days;
}
