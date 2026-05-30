package com.medianet.aiscoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Full AI-assisted scoring result for one candidature.
 *
 * Two modes:
 *  - LEGACY  (dynamicMode=false): 4 fixed criteria (innovation/feasibility/marketImpact/teamQuality)
 *  - DYNAMIC (dynamicMode=true) : programme-defined criteria in {@code dynamicScores}
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class AiScoreResult {
    private Long   candidatureId;
    private String projectName;

    /** true when scored against programme-defined criteria */
    @Builder.Default
    private boolean dynamicMode = false;

    // ── Legacy fixed criteria (null in dynamic mode) ──────────────────────────
    private CriterionScore innovation;    // weight 30%
    private CriterionScore feasibility;   // weight 25%
    private CriterionScore marketImpact;  // weight 25%
    private CriterionScore teamQuality;   // weight 20%

    // ── Dynamic programme criteria (null in legacy mode) ─────────────────────
    private List<DynamicCriterionScore> dynamicScores;

    // ── Aggregated ────────────────────────────────────────────────────────────
    /** Weighted average score (0–10) */
    private double weightedScore;

    /** AI global synthesis */
    private String globalCommentary;

    /** ACCEPT | REVIEW | REJECT */
    private String recommendation;

    /** Whether Ollama commentary was successfully applied */
    private boolean aiEnhanced;
}
