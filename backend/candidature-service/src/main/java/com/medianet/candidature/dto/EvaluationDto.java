package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationDto {
    private Long id;
    private Long candidatureId;
    private Long juryId;
    private String juryEmail;
    private String juryName;
    private Integer innovationScore;
    private Integer feasibilityScore;
    private Integer marketImpactScore;
    private Integer teamQualityScore;
    private Double weightedScore;
    private String comment;
    private LocalDateTime evaluatedAt;
}
