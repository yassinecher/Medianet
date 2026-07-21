package com.medianet.programme.dto;

import com.medianet.programme.entity.PhaseTask;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdatePhaseRequest {
    private String     title;
    private String     description;
    private Integer    phaseOrder;
    private LocalDate  startDate;
    private LocalDate  endDate;
    private String     status;
    private List<Long> focusCriteriaIds;
    // Session fields
    private String          location;
    private String          durationKind;
    private List<String>    responsibles;
    private List<String>    guests;
    private List<Long>      startupIds;
    private List<PhaseTask> tasks;
    private String          criterionWeightsJson;
    /** Évaluation sessions: saved candidature-selection (shortlist) the jury
     *  evaluates. Send -1 to clear (back to « toutes les candidatures »). */
    private Long            evaluationSelectionId;
    /** Optional — change the session type (CANDIDATURE_SUBMISSION, etc.). */
    private String          sessionType;
    /** Optional — move this session to another swimlane. */
    private String          lane;
    /** Optional — change the session bar color (hex). */
    private String          color;
    /** Optional — (re)parent this day-session under a range session. Send -1 to detach. */
    private Long            parentSessionId;
    /** Optional — VISIBLE | HIDDEN | PRIVATE. */
    private String          visibility;
    /** Optional — allow an activity agenda on this session. */
    private Boolean         allowActivities;
    /** Optional — allow this session to overlap others in its lane. */
    private Boolean         allowOverlap;
    /** Presentation day: enable pitch-video collection by porteurs. */
    private Boolean         collectPitchVideos;
    /** Pitch upload deadline (send a pre-1971 date to clear it). */
    private LocalDate       pitchDeadline;
    /** Max TRAINING videos per porteur for this session (send <=0 to clear → default). */
    private Integer         maxTrainingVideos;
}
