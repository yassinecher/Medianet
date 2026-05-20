package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Extra information specific to users with the MENTOR role.
 */
@Entity
@Table(name = "mentor_profiles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MentorProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Professional title, e.g. "Expert en Intelligence Artificielle" */
    private String title;

    @Column(columnDefinition = "TEXT")
    private String bio;

    /** Primary domain expertise, e.g. "FinTech", "HealthTech" */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mentor_expertise",
                     joinColumns = @JoinColumn(name = "mentor_profile_id"))
    @Column(name = "expertise")
    @Builder.Default
    private List<String> expertise = new ArrayList<>();

    /** Sub-specializations */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mentor_specializations",
                     joinColumns = @JoinColumn(name = "mentor_profile_id"))
    @Column(name = "specialization")
    @Builder.Default
    private List<String> specializations = new ArrayList<>();

    /** Average rating out of 5 */
    @Builder.Default
    private Double rating = 0.0;

    /** FULL_TIME | PART_TIME | WEEKENDS | ON_DEMAND */
    @Builder.Default
    private String availability = "ON_DEMAND";

    private String linkedInUrl;
    private String website;

    @Builder.Default
    private Integer yearsOfExperience = 0;

    /** Number of mentoring sessions completed */
    @Builder.Default
    private Integer sessionCount = 0;
}
