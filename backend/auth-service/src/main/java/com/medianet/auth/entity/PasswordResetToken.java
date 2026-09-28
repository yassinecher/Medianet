package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Single-use « Mot de passe oublié » link. Only the SHA-256 of the token is
 * stored, so a database leak doesn't expose usable links.
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE) // deleting a user drops their pending links
    private User user;

    /** Hex SHA-256 of the token sent by email. */
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** Set when used or superseded by a newer link. */
    private LocalDateTime usedAt;
}
