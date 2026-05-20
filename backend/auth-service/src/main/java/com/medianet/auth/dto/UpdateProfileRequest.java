package com.medianet.auth.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class UpdateProfileRequest {
    @NotBlank private String firstName;
    @NotBlank private String lastName;
    private String currentPassword;
    private String newPassword;
}
