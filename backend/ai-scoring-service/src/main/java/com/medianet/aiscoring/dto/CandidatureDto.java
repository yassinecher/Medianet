package com.medianet.aiscoring.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CandidatureDto {
    private Long id;
    private Long sessionId;
    /** Set when the candidature belongs to a programme — triggers dynamic scoring */
    private Long programmeId;
    private Long porteurId;
    private String porteurEmail;
    private String porteurName;
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
    private String status;
    private Double totalScore;
}
