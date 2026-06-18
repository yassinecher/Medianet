package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationDto {
    private Long id;
    private Long candidatureId;
    private Long juryId;
    private Long phaseId;
    private String juryEmail;
    private String juryName;

    // Dynamic criteria scores (non-empty when evaluated against a programme)
    private List<CriteriaScoreDto> criteriaScores;

    // Legacy fixed-weight fields (null when dynamic scores used)
    private Integer innovationScore;
    private Integer feasibilityScore;
    private Integer marketImpactScore;
    private Integer teamQualityScore;

    private Double weightedScore;
    private String comment;
    private LocalDateTime evaluatedAt;
}
