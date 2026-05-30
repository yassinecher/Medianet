package com.medianet.candidature.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.util.List;

@Data
public class EvaluationRequest {

    private String juryEmail;
    private String juryName;

    // ── Dynamic criteria scores (programme-defined, preferred) ────────────────
    /** When provided, these take priority over the legacy 4 fields below. */
    @Valid
    private List<CriteriaScoreRequest> criteriaScores;

    // ── Legacy fixed-weight scores (kept for backward compatibility) ──────────
    @Min(0) @Max(10)
    private Integer innovationScore;

    @Min(0) @Max(10)
    private Integer feasibilityScore;

    @Min(0) @Max(10)
    private Integer marketImpactScore;

    @Min(0) @Max(10)
    private Integer teamQualityScore;

    private String comment;
}
