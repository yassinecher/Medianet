package com.medianet.auth.dto;

import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Request body for PUT /api/auth/companies/{id}.
 * All fields optional — only non-null values are applied.
 */
@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateCompanyRequest {

    @Size(max = 150)
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
