package com.medianet.auth.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.Set;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UserDto {
    private Long id;
    private String email;
    private String firstName;
    private String lastName;

    /** All role names assigned to this user, e.g. {"ADMIN","PORTEUR"} */
    private Set<String> roles;

    /** Direct permission slugs granted to this user (beyond role permissions) */
    private Set<String> directPermissions;

    /** Effective permissions = direct + all role permissions */
    private Set<String> allPermissions;

    /** Primary role name — kept for backward compat */
    private String role;

    private boolean active;
    private LocalDateTime createdAt;

    // ── Role-specific profiles (null when role is not assigned) ──────────────
    private AdminProfileDto  adminProfile;
    private MentorProfileDto mentorProfile;
    private PorteurProfileDto porteurProfile;
    private JuryProfileDto   juryProfile;
}
