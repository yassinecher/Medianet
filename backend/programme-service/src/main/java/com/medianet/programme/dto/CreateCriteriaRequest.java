package com.medianet.programme.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateCriteriaRequest {

    @NotBlank(message = "Criterion name is required")
    private String name;

    private String description;

    @DecimalMin(value = "0.0") @DecimalMax(value = "1.0")
    private Double weight = 0.0;

    private Integer criterionOrder = 0;

    /** Set to true when this criterion was AI-suggested. */
    private Boolean aiGenerated = false;
}
