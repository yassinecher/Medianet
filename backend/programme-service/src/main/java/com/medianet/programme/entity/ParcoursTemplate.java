package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A reusable, named PARCOURS template: the full session structure of a programme
 * (sessions + nested journées + agenda activities) serialized as JSON with
 * day-offsets relative to the parcours start. Applying it to a programme
 * recreates the whole structure anchored on a chosen start date.
 */
@Entity
@Table(name = "parcours_templates")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ParcoursTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** JSON: [{ offsetDays, durationDays, title, color, sessionType, durationKind,
     *  parentIndex, location, description, days:[{title,date offset,activities:[…]}] }] */
    @Column(name = "structure_json", columnDefinition = "TEXT")
    private String structureJson;

    /** Number of top-level sessions — shown in pickers without parsing the JSON. */
    @Column(name = "session_count")
    private Integer sessionCount;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
