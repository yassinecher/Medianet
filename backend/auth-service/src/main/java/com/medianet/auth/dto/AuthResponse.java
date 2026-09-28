package com.medianet.auth.dto;

import lombok.*;
import java.util.Set;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AuthResponse {
    private String token;
    private Long   userId;
    private String email;
    private String firstName;
    private String lastName;

    /** All role names */
    private Set<String> roles;

    /** Effective permissions (direct + role-inherited) */
    private Set<String> permissions;

    /** Primary role — kept for backward compat */
    private String role;

    /** "GOOGLE" when the account signs in with Google; null for email/password only. */
    private String  authProvider;
    /** False for Google-created accounts that never chose a password. */
    private boolean hasPassword;
    /** Phone number from the role profile (porteur / admin), if any. */
    private String  phone;
}
