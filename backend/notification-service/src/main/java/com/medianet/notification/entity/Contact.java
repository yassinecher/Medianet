package com.medianet.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A reusable address-book contact. Curated by admins and reused as the source
 * of invitees across sessions/activities (managed contact list).
 */
@Entity
@Table(name = "contacts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    /** Optional organization / company. */
    private String organization;

    /** Free label (e.g. "Mentor", "Jury", "Partenaire"). */
    private String tag;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
