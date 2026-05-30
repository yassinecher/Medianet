package com.medianet.candidature.entity;

import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CriteriaScore {

    /** The criterion ID from programme-service */
    private Long criteriaId;

    /** Denormalised name for display without cross-service call */
    private String criteriaName;

    /** Score given by the jury for this criterion (0-10) */
    private Double score;

    /** Weight of this criterion (0.0-1.0) as defined in the programme */
    private Double weight;
}
