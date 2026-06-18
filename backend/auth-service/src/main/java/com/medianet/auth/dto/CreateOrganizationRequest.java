package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateOrganizationRequest {
    @NotBlank private String name;
    private String  type;             // OrganizationType — default STARTUP
    private String  description;
    private String  sector;
    private String  city;
    private String  country;
    private String  address;
    private String  website;
    private String  contactEmail;
    private String  contactPhone;
    private Integer foundedYear;
    private String  employeeCount;
    private String  logoUrl;
    private Boolean internal;
    private Long    linkedCompanyId;  // optional bridge to legacy Company
}
