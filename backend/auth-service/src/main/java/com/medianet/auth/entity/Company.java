package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A startup / company owned by a porteur.
 * One porteur can have multiple companies; each company can be submitted
 * to one or more programmes independently.
 */
@Entity
@Table(name = "companies")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owner — must have PORTEUR role */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "porteur_id", nullable = false)
    private User porteur;

    @Column(nullable = false)
    private String name;

    /** Sector / industry (e.g. "FinTech", "AgriTech", "AI/ML") */
    private String sector;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CompanyStage stage = CompanyStage.IDEA;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String city;
    private String website;
    private String linkedInUrl;
    private String logoUrl;

    private Integer teamSize;

    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
