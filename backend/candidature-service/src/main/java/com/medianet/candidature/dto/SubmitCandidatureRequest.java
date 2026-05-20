package com.medianet.candidature.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SubmitCandidatureRequest {
    @NotNull
    private Long sessionId;

    @NotBlank
    private String projectName;

    private String projectDescription;
    private String domain;
    private String targetMarket;
    private String currentStage;
    private Integer teamSize;
    private String techStack;
    private String problemStatement;
    private String solutionDescription;
    private String businessModel;
    private String teamBackground;
}
