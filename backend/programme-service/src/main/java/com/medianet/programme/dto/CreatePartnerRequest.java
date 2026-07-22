package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreatePartnerRequest {
    @NotBlank(message = "Partner name is required")
    private String name;
    private String logoUrl;
    private String description;
    private String website;
    private String contactEmail;
    private String contactPhone;
    private Boolean publicVisible;
}
