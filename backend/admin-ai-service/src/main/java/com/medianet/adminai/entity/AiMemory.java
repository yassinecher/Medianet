package com.medianet.adminai.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A piece of persistent context the AI should always know about the platform.
 *
 * <p>Examples: "preferred sectors: tech, finance", "default programme duration:
 * 6 months", "admin team email: contact@medianet.tn".
 *
 * <p>Every entry is injected into the system prompt on every chat turn, so the
 * AI never has to re-learn these facts. Admin manages via remember_fact /
 * forget_fact tools (or directly via SQL).
 */
@Entity
@Table(name = "ai_memory")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Short label / topic, e.g. "default_programme_duration". */
    @Column(nullable = false, unique = true)
    private String factKey;

    /** Free-form value (sentence or longer). Stored as TEXT for long facts. */
    @Column(name = "fact_value", columnDefinition = "TEXT", nullable = false)
    private String factValue;

    /**
     * Optional category to group related facts in the prompt.
     * Examples: "platform", "team", "preferences", "tone".
     */
    @Column(name = "category", length = 40)
    @Builder.Default
    private String category = "general";

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
