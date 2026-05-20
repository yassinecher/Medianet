package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidatureDto {
    private Long id;
    private Long sessionId;
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
    private String rejectionReason;
    private LocalDateTime submittedAt;
    private LocalDateTime updatedAt;
    private List<EvaluationDto> evaluations;
    private List<JuryAssignmentDto> juryAssignments;
}
