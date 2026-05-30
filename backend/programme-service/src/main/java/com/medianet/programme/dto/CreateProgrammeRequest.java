package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateProgrammeRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    /** PUBLIC or PRIVATE — defaults to PUBLIC if null */
    private String type;

    private String    status;
    /** STANDARD | MINIMAL | FOODSTART | TECH | AGRITECH — defaults to STANDARD */
    private String    formTemplate;
    /** JSON-encoded custom form schema. When set, overrides formTemplate. */
    private String    customFormSchema;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate applicationDeadline;
    private Integer   maxApplications;
    private List<String> sectors;

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
