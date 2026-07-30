package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A startup's participation in ONE programme — the parent link that ties an
 * organisation to a programme. Created when a candidature is accepted (synced
 * from candidature-service) or added manually by an admin.
 *
 * <p>The per-programme mentor (« vis-à-vis ») and the coaching plan/notes hang
 * off THIS record, so an organisation can be in several programmes, each with
 * its own mentor and its own coaching — which the old org-global model could
 * not express.
 */
@Entity
@Table(name = "programme_participants",
       uniqueConstraints = @UniqueConstraint(columnNames = {"programmeId", "organizationId"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProgrammeParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long programmeId;

    @Column(nullable = false)
    private Long organizationId;

    /** Denormalised snapshot so the roster reads without a cross-service call. */
    private String organizationName;

    /** The founder representing this startup in this programme (candidature porteur). */
    private Long porteurUserId;
    private String porteurName;
    private String porteurEmail;

    /** The assigned mentor / « vis-à-vis » for THIS programme. Null = none yet. */
    private Long mentorUserId;

    /** ACTIVE · ALUMNI · WITHDRAWN. */
    @Column(length = 16)
    @Builder.Default
    private String status = "ACTIVE";

    @CreationTimestamp
    private LocalDateTime joinedAt;
}
