package com.medianet.candidature.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "candidatures")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidature {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * @deprecated session-service was removed. This column is kept nullable for
     * backward compatibility with rows created before the migration. New rows
     * should have programmeId set instead.
     */
    @Deprecated
    private Long sessionId;

    /** Programme this candidature belongs to (nullable for legacy records) */
    private Long programmeId;

    /** Company the porteur is applying with (nullable for legacy records) */
    private Long companyId;

    /**
     * Organisation chosen by the porteur when applying.
     * Required when the target session is of type CANDIDATURE_SUBMISSION.
     * Set independently of {@link #companyId} during the transition — long-term
     * the Organization replaces Company.
     */
    private Long organizationId;

    /** Phase of the programme targeted (nullable — applies to whole programme if null) */
    private Long phaseId;

    @Column(nullable = false)
    private Long porteurId;

    private String porteurEmail;
    private String porteurName;

    // ── Section 1: Company & Team ─────────────────────────────────────────────
    private String companyName;
    private String contactEmail;
    private String contactPhone;
    private String founderName;
    private String founderEmail;

    @Column(columnDefinition = "TEXT")
    private String coFounders;

    @Column(columnDefinition = "TEXT")
    private String teamBackground;

    private String engagementLevel;

    // ── Section 2: Project ────────────────────────────────────────────────────
    @Column(nullable = false)
    private String projectName;

    @Column(columnDefinition = "TEXT")
    private String projectDescription;

    @Column(columnDefinition = "TEXT")
    private String problemStatement;

    @Column(columnDefinition = "TEXT")
    private String solutionDescription;

    @Column(columnDefinition = "TEXT")
    private String competitiveAdvantage;

    @Column(columnDefinition = "TEXT")
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

    @Column(columnDefinition = "TEXT")
    private String businessModel;

    @Column(columnDefinition = "TEXT")
    private String distributionChannels;

    private Long fundingRequired;

    // ── Section 4: Motivation ─────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String motivation;

    @Column(columnDefinition = "TEXT")
    private String supportNeeds;

    @Column(columnDefinition = "TEXT")
    private String otherNeeds;

    @Column(columnDefinition = "TEXT")
    private String programmeExpectations;

    @Column(columnDefinition = "TEXT")
    private String pitchDeckUrl;

    /**
     * JSON-encoded answers to custom form fields (when programme uses a
     * custom form schema instead of a preset template). Map of fieldKey → value.
     */
    @Column(columnDefinition = "TEXT")
    private String customAnswers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CandidatureStatus status = CandidatureStatus.PENDING;

    private Double totalScore;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    private LocalDateTime submittedAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = CandidatureStatus.PENDING;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
