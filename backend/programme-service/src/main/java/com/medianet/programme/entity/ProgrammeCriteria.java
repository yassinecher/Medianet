package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * An evaluation criterion belonging to a Programme.
 * Weights across all active criteria of a programme must sum to 1.0.
 */
@Entity
@Table(name = "programme_criteria")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProgrammeCriteria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programme_id", nullable = false)
    private Programme programme;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * Weight of this criterion in the final score (0.0 – 1.0).
     * The sum of all active criteria weights in a programme should equal 1.0.
     */
    @Builder.Default
    private Double weight = 0.0;

    /** Display order within the programme. */
    @Column(name = "criterion_order")
    @Builder.Default
    private Integer criterionOrder = 0;

    /** True when this criterion was suggested by the AI. */
    @Builder.Default
    private Boolean aiGenerated = false;

    @Builder.Default
    private Boolean active = true;
}
