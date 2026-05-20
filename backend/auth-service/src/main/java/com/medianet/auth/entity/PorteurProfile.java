package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Extra information specific to users with the PORTEUR role (project owners / startup founders).
 */
@Entity
@Table(name = "porteur_profiles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PorteurProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Company or startup name */
    private String company;

    /** Sector / industry (e.g. "AgriTech", "FinTech") */
    private String sector;

    private String city;
    private String phoneNumber;
    private String website;
    private String linkedInUrl;

    @Column(columnDefinition = "TEXT")
    private String bio;

    /** Number of candidatures submitted */
    @Builder.Default
    private Integer candidatureCount = 0;
}
