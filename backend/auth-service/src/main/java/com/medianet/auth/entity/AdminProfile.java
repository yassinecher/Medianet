package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Extra information specific to users with the ADMIN role.
 */
@Entity
@Table(name = "admin_profiles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AdminProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Department or service (e.g. "Direction Technique") */
    private String department;

    private String phoneNumber;

    /** SUPER_ADMIN | ADMIN */
    @Builder.Default
    private String adminLevel = "ADMIN";

    private LocalDateTime lastLoginAt;
}
