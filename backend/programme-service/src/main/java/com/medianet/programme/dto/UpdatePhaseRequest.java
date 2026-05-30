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
    /** Optional — change the session type (CANDIDATURE_SUBMISSION, etc.). */
    private String          sessionType;
    /** Optional — move this session to another swimlane. */
    private String          lane;
}
