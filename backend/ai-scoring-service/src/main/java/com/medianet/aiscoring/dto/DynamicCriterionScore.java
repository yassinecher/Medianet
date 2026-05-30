package com.medianet.aiscoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Score + commentary for one programme-defined criterion in dynamic mode.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DynamicCriterionScore {
    private Long   criteriaId;
    private String criteriaName;
    /** Weight as fraction (0.0–1.0) taken from the programme criteria definition */
    private double weight;
    /** Rule-based or AI-refined score (0–10) */
    private int    score;
    private String commentary;
}
