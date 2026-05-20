package com.medianet.candidature.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

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

    // Weights: Innovation 30%, Feasibility 25%, MarketImpact 25%, TeamQuality 20%
    private Integer innovationScore;    // 0-10
    private Integer feasibilityScore;   // 0-10
    private Integer marketImpactScore;  // 0-10
    private Integer teamQualityScore;   // 0-10
    private Double weightedScore;       // calculated

    @Column(columnDefinition = "TEXT")
    private String comment;

    private LocalDateTime evaluatedAt;

    @PrePersist
    protected void onCreate() {
        evaluatedAt = LocalDateTime.now();
        calculateWeightedScore();
    }

    public void calculateWeightedScore() {
        if (innovationScore != null && feasibilityScore != null
                && marketImpactScore != null && teamQualityScore != null) {
            this.weightedScore = (innovationScore * 0.30)
                    + (feasibilityScore * 0.25)
                    + (marketImpactScore * 0.25)
                    + (teamQualityScore * 0.20);
        }
    }
}
