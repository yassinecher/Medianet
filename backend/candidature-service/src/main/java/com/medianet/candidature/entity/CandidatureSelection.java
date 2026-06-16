package com.medianet.candidature.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A named, ordered selection (shortlist) of candidatures within a programme —
 * used by the Présélection (vote) session to save several versions of the list
 * (e.g. "Top 10", "Finalistes"). The order matters; ids are stored CSV.
 */
@Entity
@Table(name = "candidature_selections")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CandidatureSelection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long programmeId;

    @Column(nullable = false)
    private String name;

    /** Ordered, comma-separated candidature ids (the shortlist). */
    @Column(columnDefinition = "TEXT")
    private String candidatureIds;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
