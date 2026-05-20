package com.medianet.auth.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateAdminProfileRequest {
    private String department;
    private String phoneNumber;
    private String adminLevel;
}
