package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProgrammeDto {
    private Long   id;
    private String title;
    private String description;
    private String type;
    private String status;
    /** Computed: programme is accepting candidatures now (status + candidature-session window). */
    private Boolean   acceptingApplications;
    /** Computed: id of the candidature session (CANDIDATURE_SUBMISSION), or null. */
    private Long      candidatureSessionId;
    /** Computed: end date of the candidature session (the application deadline). */
    private LocalDate candidatureDeadline;
    private String formTemplate;
    /** JSON-encoded custom form schema. Null = use formTemplate. */
    private String customFormSchema;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate applicationDeadline;
    private Integer   maxApplications;
    private Long      createdByAdminId;
    private String    createdByAdminName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<String>               sectors;
    private List<ProgrammeCriteriaDto> criteria;
    private List<ProgrammePhaseDto>    phases;
    private List<PartnerDto>           partners;

    // Rich presentation
    private String  tagline;
    private String  logoUrl;
    private String  bannerImageUrl;
    private String  location;
    private String  applicationUrl;

    // Key stats
    private Integer expertCount;
    private Integer trainingSessionsCount;
    private Integer mentoringHoursPerMonth;
    private Integer maxStartups;

    // Structured lists
    private List<String> objectives;
    private List<String> benefits;
}
