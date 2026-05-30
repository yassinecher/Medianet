package com.medianet.programme.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateCriteriaRequest {
    private String  name;
    private String  description;

    @DecimalMin(value = "0.0") @DecimalMax(value = "1.0")
    private Double  weight;

    private Integer criterionOrder;
    private Boolean active;
}
