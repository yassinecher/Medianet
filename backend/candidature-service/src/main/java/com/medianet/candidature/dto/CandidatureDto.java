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
    private Long programmeId;
    private String programmeName;
    private Long companyId;
    private Long organizationId;
    private Long phaseId;
    private Long porteurId;
    private String porteurEmail;
    private String porteurName;

    // ── Section 1: Company & Team ─────────────────────────────────────────────
    private String companyName;
    private String contactEmail;
    private String contactPhone;
    private String founderName;
    private String founderEmail;
    private String coFounders;
    private String teamBackground;
    private String engagementLevel;

    // ── Section 2: Project ────────────────────────────────────────────────────
    private String projectName;
    private String projectDescription;
    private String problemStatement;
    private String solutionDescription;
    private String competitiveAdvantage;
    private String technologyDescription;
    private String sector;
    private String domain;
    private String currentStage;
    private Integer teamSize;
    private String techStack;

    // ── Section 3: Market & Business ─────────────────────────────────────────
    private String targetMarket;
    private Boolean hasCustomers;
    private Boolean hasPriorIncubation;
    private String priorIncubationDetails;
    private String businessModel;
    private String distributionChannels;
    private Long fundingRequired;

    // ── Section 4: Motivation ─────────────────────────────────────────────────
    private String motivation;
    private String supportNeeds;
    private String otherNeeds;
    private String programmeExpectations;
    private String pitchDeckUrl;

    // ── Custom form answers ──────────────────────────────────────────────────
    private String customAnswers;

    private String status;
    private Double totalScore;
    private String rejectionReason;
    private LocalDateTime submittedAt;
    private LocalDateTime updatedAt;
    private List<EvaluationDto> evaluations;
    private List<JuryAssignmentDto> juryAssignments;
}
