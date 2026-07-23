package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Canva Connect OAuth tokens of one back-office user. Stored server-side only —
 * the client id/secret and these tokens NEVER reach the browser.
 */
@Entity
@Table(name = "canva_tokens", uniqueConstraints = @UniqueConstraint(columnNames = "userEmail"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CanvaToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userEmail;

    @Column(columnDefinition = "TEXT")
    private String accessToken;

    @Column(columnDefinition = "TEXT")
    private String refreshToken;

    /** When the access token expires (refresh happens automatically before). */
    private LocalDateTime expiresAt;

    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    void touch() { updatedAt = LocalDateTime.now(); }
}
