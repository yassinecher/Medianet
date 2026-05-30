package com.medianet.candidature.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SubmitCandidatureRequest {

    /** Optional — legacy session reference; can be null for programme-based candidatures */
    private Long sessionId;

    /** Programme being applied to */
    private Long programmeId;

    private Long companyId;
    /** Organisation chosen by the porteur — REQUIRED for CANDIDATURE_SUBMISSION sessions. */
    private Long organizationId;
    private Long phaseId;

    // ── Section 1: Company & Team ─────────────────────────────────────────────
    private String companyName;
    private String contactEmail;
    private String contactPhone;
    private String founderName;
    private String founderEmail;
    private String coFounders;
    private String teamBackground;
    private String engagementLevel;   // PART_TIME | FULL_TIME

    // ── Section 2: Project ────────────────────────────────────────────────────
    @NotBlank(message = "Project name is required")
    private String projectName;

    private String projectDescription;
    private String problemStatement;
    private String solutionDescription;
    private String competitiveAdvantage;
    private String technologyDescription;
    private String sector;            // comma-separated sectors chosen
    private String domain;            // legacy alias
    private String currentStage;      // IDEA | PROTOTYPE | MVP | COMMERCIALIZED
    private Integer teamSize;

    // ── Section 3: Market & Business ─────────────────────────────────────────
    private String targetMarket;
    private Boolean hasCustomers;
    private Boolean hasPriorIncubation;
    private String priorIncubationDetails;
    private String businessModel;
    private String distributionChannels;
    private String techStack;
    private Long fundingRequired;

    // ── Section 4: Motivation ─────────────────────────────────────────────────
    private String motivation;
    private String supportNeeds;      // comma-separated selected options
    private String otherNeeds;
    private String programmeExpectations;
    private String pitchDeckUrl;

    // ── Custom form answers ──────────────────────────────────────────────────
    /** JSON object of { fieldKey: value } for programmes using a custom form. */
    private String customAnswers;
}
