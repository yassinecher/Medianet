package com.medianet.candidature.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "evaluations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Evaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long candidatureId;

    private Long juryId;
    private String juryEmail;
    private String juryName;

    // ── Legacy fixed-weight scores (kept for backward compatibility) ──────────
    // Weights: Innovation 30%, Feasibility 25%, MarketImpact 25%, TeamQuality 20%
    private Integer innovationScore;    // 0-10
    private Integer feasibilityScore;   // 0-10
    private Integer marketImpactScore;  // 0-10
    private Integer teamQualityScore;   // 0-10

    // ── Dynamic criteria scores (programme-defined weights) ───────────────────
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
        name = "evaluation_criteria_scores",
        joinColumns = @JoinColumn(name = "evaluation_id")
    )
    @Builder.Default
    private List<CriteriaScore> criteriaScores = new ArrayList<>();

    /** Final weighted score (calculated from dynamic or legacy scores) */
    private Double weightedScore;

    @Column(columnDefinition = "TEXT")
    private String comment;

    private LocalDateTime evaluatedAt;

    @PrePersist
    protected void onCreate() {
        evaluatedAt = LocalDateTime.now();
        calculateWeightedScore();
    }

    /**
     * Recalculates weightedScore.
     * Priority: dynamic criteriaScores if present; falls back to legacy 4-field formula.
     */
    public void calculateWeightedScore() {
        if (criteriaScores != null && !criteriaScores.isEmpty()) {
            // Dynamic: sum(score * weight) / sum(weight)  — normalised so unequal weights work
            double weightedSum = 0;
            double totalWeight = 0;
            for (CriteriaScore cs : criteriaScores) {
                if (cs.getScore() != null && cs.getWeight() != null) {
                    weightedSum += cs.getScore() * cs.getWeight();
                    totalWeight  += cs.getWeight();
                }
            }
            this.weightedScore = totalWeight > 0 ? (weightedSum / totalWeight) : null;
        } else if (innovationScore != null && feasibilityScore != null
                && marketImpactScore != null && teamQualityScore != null) {
            // Legacy fixed-weight formula
            this.weightedScore = (innovationScore  * 0.30)
                               + (feasibilityScore * 0.25)
                               + (marketImpactScore * 0.25)
                               + (teamQualityScore  * 0.20);
        }
    }
}
