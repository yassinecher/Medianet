package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateOrganizationMemberRequest {
    private Long         userId;       // optional — if member already has an account
    @NotBlank private String fullName;
    private String       email;
    private String       phone;
    private String       role;
    private String       responsibilities;
    private List<String> expertise;
    private String       type;         // INTERNAL | EXTERNAL — default INTERNAL
}
