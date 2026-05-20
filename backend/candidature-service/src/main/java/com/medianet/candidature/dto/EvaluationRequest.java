package com.medianet.candidature.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EvaluationRequest {
    private String juryEmail;
    private String juryName;

    @NotNull
    @Min(0)
    @Max(10)
    private Integer innovationScore;

    @NotNull
    @Min(0)
    @Max(10)
    private Integer feasibilityScore;

    @NotNull
    @Min(0)
    @Max(10)
    private Integer marketImpactScore;

    @NotNull
    @Min(0)
    @Max(10)
    private Integer teamQualityScore;

    private String comment;
}
