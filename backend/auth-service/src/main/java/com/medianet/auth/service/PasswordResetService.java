package com.medianet.auth.service;

import com.medianet.auth.entity.PasswordResetToken;
import com.medianet.auth.entity.User;
import com.medianet.auth.repository.PasswordResetTokenRepository;
import com.medianet.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/**
 * « Mot de passe oublié » — also how a Google-created account (random password)
 * can get a real one without being logged in.
 *
 * <ul>
 *   <li>{@link #requestReset} never reveals whether the email exists.</li>
 *   <li>Links are random 256-bit tokens, valid 1 hour, single use; only their
 *       SHA-256 is stored; issuing a new link invalidates older ones.</li>
 *   <li>At most one email per account per minute.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PasswordResetService {

    private static final Duration TTL = Duration.ofHours(1);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final NotificationClient notificationClient;

    @Value("${frontoffice.url:http://localhost:3000}")
    private String frontofficeUrl;

    /** Emails a reset link if an active account uses this address; silent otherwise. */
    public void requestReset(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) return;
        User user = users.findFirstByEmailIgnoreCase(rawEmail.trim()).orElse(null);
        if (user == null || !user.isActive()) return;

        LocalDateTime now = LocalDateTime.now();
        boolean tooSoon = tokens.findFirstByUserIdOrderByCreatedAtDesc(user.getId())
                .map(t -> t.getCreatedAt().isAfter(now.minus(COOLDOWN)))
                .orElse(false);
        if (tooSoon) return;

        tokens.invalidateAll(user.getId(), now);
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        tokens.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(sha256(token))
                .createdAt(now)
                .expiresAt(now.plus(TTL))
                .build());

        String link = frontofficeUrl.replaceAll("/+$", "") + "/reset-password?token=" + token;
        boolean hasPassword = !Boolean.FALSE.equals(user.getPasswordSet());
        String name = (nz(user.getFirstName()) + " " + nz(user.getLastName())).trim();
        notificationClient.sendEmail(user.getEmail(), name.isEmpty() ? user.getEmail() : name,
                hasPassword ? "Réinitialisation de votre mot de passe" : "Définissez votre mot de passe",
                email(name, link, hasPassword));
        log.info("Password reset link sent to user {}", user.getId());
    }

    /**
     * Sets the new password from a valid link.
     *
     * @return true when the account is an administrator (the page then offers
     *         the back-office login as well)
     */
    public boolean resetPassword(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins 8 caractères.");
        }
        LocalDateTime now = LocalDateTime.now();
        PasswordResetToken t = (token == null || token.isBlank()) ? null
                : tokens.findByTokenHash(sha256(token.trim())).orElse(null);
        if (t == null || t.getUsedAt() != null || t.getExpiresAt().isBefore(now) || !t.getUser().isActive()) {
            throw new IllegalArgumentException("Ce lien est invalide ou a expiré. Demandez un nouveau lien.");
        }
        User user = t.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordSet(true);
        users.save(user);
        tokens.invalidateAll(user.getId(), now); // this link and any other pending one
        return user.getRoleNames().contains("ADMIN");
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** Same visual language as the org-invitation email (OrganizationService). */
    private static String email(String name, String link, boolean hasPassword) {
        String intro = hasPassword
                ? "Vous avez demandé à réinitialiser le mot de passe de votre compte Medianet Incubateur."
                : "Votre compte Medianet Incubateur a été créé avec Google. Définissez un mot de passe pour "
                  + "pouvoir aussi vous connecter avec votre adresse email.";
        String button = hasPassword ? "Choisir un nouveau mot de passe" : "Définir mon mot de passe";
        return "<div style=\"font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:auto;color:#0f172a;line-height:1.5\">"
                + "<p style=\"font-size:13px;color:#64748b;margin:0 0 16px\">Medianet Incubateur</p>"
                + "<p>Bonjour" + (name.isEmpty() ? "" : " " + escape(name)) + ",</p>"
                + "<p>" + intro + "</p>"
                + "<p style=\"margin:24px 0\"><a href=\"" + link
                + "\" style=\"background:#00A3E0;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block\">"
                + button + "</a></p>"
                + "<p style=\"color:#64748b;font-size:13px\">Ce lien est valable 1 heure et ne peut servir qu'une fois. "
                + "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>"
                + "<span style=\"color:#0084c7;word-break:break-all\">" + link + "</span></p>"
                + "<hr style=\"border:none;border-top:1px solid #e2e8f0;margin:24px 0\">"
                + "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Si vous n'êtes pas à l'origine de cette demande, "
                + "ignorez cet email : votre mot de passe actuel reste inchangé.</p></div>";
    }
}
