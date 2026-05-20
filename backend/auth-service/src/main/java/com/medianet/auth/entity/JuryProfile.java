package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Extra information specific to users with the JURY role.
 */
@Entity
@Table(name = "jury_profiles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class JuryProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Professional title, e.g. "Directeur d'Investissement" */
    private String title;

    @Column(columnDefinition = "TEXT")
    private String bio;

    /** Organisation / company they represent */
    private String affiliation;

    /** Areas of expertise, e.g. ["FinTech", "HealthTech"] */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "jury_expertise",
                     joinColumns = @JoinColumn(name = "jury_profile_id"))
    @Column(name = "expertise")
    @Builder.Default
    private List<String> expertise = new ArrayList<>();

    private String linkedInUrl;

    /** Total evaluations completed across all sessions */
    @Builder.Default
    private Integer evaluationCount = 0;

    /** Computed average score given across all evaluations */
    @Builder.Default
    private Double averageScore = 0.0;
}
