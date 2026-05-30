package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreatePartnerRequest {
    @NotBlank(message = "Partner name is required")
    private String name;
    private String logoUrl;
}
