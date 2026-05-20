package com.medianet.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.HashSet;
import java.util.Set;

@Data
public class RegisterRequest {
    @Email
    @NotBlank
    private String email;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @NotBlank
    private String password;

    /** Primary role (e.g. "PORTEUR"). Kept for simple registration flow. */
    private String role;

    /** Optional: multiple roles at registration time (admin use) */
    private Set<String> roles = new HashSet<>();
}
