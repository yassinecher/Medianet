package com.medianet.candidature.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CriteriaScoreRequest {

    @NotNull
    private Long criteriaId;

    private String criteriaName;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("10.0")
    private Double score;

    /** Weight of this criterion (0.0–1.0). Sent by client to avoid cross-service call. */
    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private Double weight;
}
