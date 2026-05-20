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
}
