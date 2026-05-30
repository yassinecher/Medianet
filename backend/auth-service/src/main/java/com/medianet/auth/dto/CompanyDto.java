package com.medianet.auth.dto;

import lombok.*;

import java.time.LocalDateTime;

/**
 * Response DTO for Company.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CompanyDto {

    private Long   id;
    private String name;
    private String sector;
    private String stage;        // CompanyStage enum name
    private String description;
    private String city;
    private String website;
    private String linkedInUrl;
    private String logoUrl;
    private Integer teamSize;
    private Boolean active;

    // Porteur summary (denormalized for convenience)
    private Long   porteurId;
    private String porteurName;
    private String porteurEmail;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
