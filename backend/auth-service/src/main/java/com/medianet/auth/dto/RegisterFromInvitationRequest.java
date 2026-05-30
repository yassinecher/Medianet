package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Payload used when a JURY/MENTOR (or any invited role) finishes registration
 * after clicking a link in their invitation email.
 *
 * <p>Email and role are NOT in this payload — they come from the invitation
 * looked up server-side via the token, so the recipient cannot impersonate
 * a different email or grant themselves a different role.
 */
@Data
public class RegisterFromInvitationRequest {

    @NotBlank(message = "Invitation token is required")
    private String token;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @NotBlank
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    /** Optional phone number — stored on the role-specific profile. */
    private String phone;
}
