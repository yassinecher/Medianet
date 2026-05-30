package com.medianet.auth.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateOrganizationRequest {
    private String  name;
    private String  type;
    private String  description;
    private String  sector;
    private String  city;
    private String  country;
    private String  website;
    private String  contactEmail;
    private String  contactPhone;
    private String  logoUrl;
    private Boolean internal;
    private Long    linkedCompanyId;
}
