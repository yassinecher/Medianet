package com.medianet.aiscoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Score + commentary for a single evaluation criterion.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CriterionScore {
    /** 0–10 */
    private int score;
    /** Detailed justification from Claude */
    private String commentary;
}
