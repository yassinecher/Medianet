package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Request body for POST /api/auth/companies.
 */
@Data @NoArgsConstructor @AllArgsConstructor
public class CreateCompanyRequest {

    @NotBlank(message = "Company name is required")
    @Size(max = 150, message = "Name must be at most 150 characters")
    private String name;

    private String sector;

    /** One of: IDEA | PROTOTYPE | MVP | PILOT | LIVE */
    private String stage;

    private String description;
    private String city;
    private String website;
    private String linkedInUrl;
    private String logoUrl;
    private Integer teamSize;
}
