package com.medianet.programme.dto;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProgrammeCriteriaDto {
    private Long    id;
    private String  name;
    private String  description;
    private Double  weight;
    private Integer criterionOrder;
    private Boolean aiGenerated;
    private Boolean active;
}
