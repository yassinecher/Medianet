package com.medianet.aiscoring.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * Mirrors programme-service ProgrammeCriteriaDto.
 * Only the fields we actually use for scoring are mapped.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProgrammeCriteriaDto {
    private Long id;
    private String name;
    private String description;
    /** Weight as a fraction (e.g. 0.30 = 30%).  May be 0 if admin left it blank. */
    private Double weight;
    private Integer criterionOrder;
    private Boolean active;
    private Boolean aiGenerated;
}
