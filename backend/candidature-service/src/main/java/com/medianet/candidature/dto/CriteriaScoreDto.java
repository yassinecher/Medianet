package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CriteriaScoreDto {
    private Long criteriaId;
    private String criteriaName;
    private Double score;
    private Double weight;
}
