package com.medianet.candidature.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "jury_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JuryAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long candidatureId;
    private Long juryId;
    private String juryEmail;
    private String juryName;

    /** Opaque token for the no-login evaluation page. */
    @Column(unique = true)
    private String token;

    /** PENDING | SUBMITTED */
    private String status;

    /** The evaluating (préselection) session id — its criteria/weights drive the grid. */
    private Long phaseId;

    private LocalDateTime assignedAt;

    @PrePersist
    protected void onCreate() {
        assignedAt = LocalDateTime.now();
        if (status == null) status = "PENDING";
    }
}
