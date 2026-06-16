package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A reusable starting point for creating sessions on the Parcours timeline.
 *
 * <p>A preset is "light": it carries the session type, a default title, a color,
 * and the duration kind (day vs range). Applying a preset just seeds a new
 * session with these values — the admin then tweaks dates/agenda.
 *
 * <p>Scope:
 * <ul>
 *   <li>{@code programmeId == null} → <b>global</b> preset, available everywhere.</li>
 *   <li>{@code programmeId != null} → <b>local</b> preset, only in that programme.</li>
 * </ul>
 *
 * <p>The 7 original presets (Candidature…Formation) are seeded as global
 * {@code builtIn=true} rows. Built-ins can be edited but not deleted.
 */
@Entity
@Table(name = "session_presets")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SessionPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null = global (all programmes); set = scoped to this programme only. */
    @Column(name = "programme_id")
    private Long programmeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_type", length = 32, nullable = false)
    @Builder.Default
    private SessionType sessionType = SessionType.INCUBATION;

    @Column(nullable = false)
    private String title;

    /** Hex color used for the preset pill + the session bar (e.g. "#0EA5E9"). */
    @Column(length = 16)
    private String color;

    /** "day" or "range". */
    @Column(name = "duration_kind", length = 16)
    @Builder.Default
    private String durationKind = "day";

    /** Seeded defaults — editable but protected from deletion. */
    @Column(name = "built_in")
    @Builder.Default
    private Boolean builtIn = false;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
