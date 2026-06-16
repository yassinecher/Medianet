package com.medianet.candidature.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class SelectionRequest {
    @NotBlank
    private String name;
    /** Ordered candidature ids that make up this version (the shortlist). */
    private List<Long> candidatureIds;
}
