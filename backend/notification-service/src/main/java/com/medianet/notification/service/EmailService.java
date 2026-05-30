package com.medianet.notification.service;

import com.medianet.notification.entity.Invitation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.from-name}")
    private String fromName;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Send a plain invitation email (no RSVP links).
     */
    public void sendInvitationEmail(Invitation inv) {
        String html = buildInvitationHtml(inv);
        send(inv.getRecipientEmail(), inv.getRecipientName(), inv.getSubject(), html);
    }

    /**
     * Send an invitation email with Accept / Decline RSVP links.
     */
    public void sendRsvpEmail(Invitation inv) {
        String html = buildRsvpHtml(inv);
        send(inv.getRecipientEmail(), inv.getRecipientName(), inv.getSubject(), html);
    }

    /**
     * Send an invitation that asks the recipient to create an account.
     * Used for JURY / MENTOR invitations — the email contains a single
     * "Créer mon compte" button that opens /invitations/{token}/register.
     */
    public void sendAccountInvitationEmail(Invitation inv) {
        String html = buildAccountInviteHtml(inv);
        send(inv.getRecipientEmail(), inv.getRecipientName(), inv.getSubject(), html);
    }

    /**
     * Send a freeform HTML or plain-text email to a single address.
     */
    public void sendRaw(String toEmail, String toName, String subject, String body, boolean isHtml) {
        send(toEmail, toName, subject, isHtml ? body : "<pre style='font-family:sans-serif'>" + body + "</pre>");
    }

    /**
     * Send the same email to multiple addresses (BCC-safe one-by-one to avoid header leakage).
     */
    public void sendBroadcast(List<String> toEmails, String subject, String body, boolean isHtml) {
        for (String email : toEmails) {
            try {
                sendRaw(email, null, subject, body, isHtml);
            } catch (Exception e) {
                log.error("Broadcast failed for {}: {}", email, e.getMessage());
            }
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private void send(String to, String toName, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("Email sent → {} | {}", to, subject);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Email delivery failed: " + e.getMessage(), e);
        }
    }

    // ── HTML templates ────────────────────────────────────────────────────────

    private String buildInvitationHtml(Invitation inv) {
        String name    = inv.getRecipientName() != null ? inv.getRecipientName() : "there";
        String context = buildContextLine(inv);

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
            <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
                    <!-- Header -->
                    <tr><td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;">Medianet Incubateur</h1>
                      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">Plateforme d'incubation</p>
                    </td></tr>
                    <!-- Body -->
                    <tr><td style="padding:40px;">
                      <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">%s</h2>
                      %s
                      <p style="color:#444;font-size:15px;line-height:1.7;margin:24px 0;">Bonjour <strong>%s</strong>,</p>
                      <div style="color:#444;font-size:15px;line-height:1.8;white-space:pre-wrap;">%s</div>
                    </td></tr>
                    <!-- Footer -->
                    <tr><td style="background:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #e8ecef;">
                      <p style="color:#888;font-size:12px;margin:0;">© 2025 Medianet Incubateur · Tous droits réservés</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """.formatted(inv.getSubject(), context, name, inv.getMessage());
    }

    private String buildRsvpHtml(Invitation inv) {
        String name      = inv.getRecipientName() != null ? inv.getRecipientName() : "there";
        String context   = buildContextLine(inv);
        String acceptUrl = frontendUrl + "/invitations/" + inv.getToken() + "/accept";
        String declineUrl = frontendUrl + "/invitations/" + inv.getToken() + "/decline";

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
            <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
                    <!-- Header -->
                    <tr><td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;">Medianet Incubateur</h1>
                      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">Plateforme d'incubation</p>
                    </td></tr>
                    <!-- Body -->
                    <tr><td style="padding:40px;">
                      <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">%s</h2>
                      %s
                      <p style="color:#444;font-size:15px;line-height:1.7;margin:24px 0;">Bonjour <strong>%s</strong>,</p>
                      <div style="color:#444;font-size:15px;line-height:1.8;white-space:pre-wrap;margin-bottom:32px;">%s</div>
                      <!-- RSVP Buttons -->
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="padding-right:12px;">
                            <a href="%s" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:.3px;">✓ Accepter</a>
                          </td>
                          <td>
                            <a href="%s" style="display:inline-block;background:#fff;color:#d32f2f;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;border:2px solid #d32f2f;letter-spacing:.3px;">✗ Décliner</a>
                          </td>
                        </tr>
                      </table>
                      <p style="color:#999;font-size:12px;text-align:center;margin-top:20px;">Ces liens sont à usage unique et vous sont destinés personnellement.</p>
                    </td></tr>
                    <!-- Footer -->
                    <tr><td style="background:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #e8ecef;">
                      <p style="color:#888;font-size:12px;margin:0;">© 2025 Medianet Incubateur · Tous droits réservés</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """.formatted(inv.getSubject(), context, name, inv.getMessage(), acceptUrl, declineUrl);
    }

    private String buildAccountInviteHtml(Invitation inv) {
        String name        = inv.getRecipientName() != null ? inv.getRecipientName() : "there";
        String context     = buildContextLine(inv);
        String registerUrl = frontendUrl + "/invitations/" + inv.getToken() + "/register";
        String roleLabel   = roleLabel(inv.getType() != null ? inv.getType().name() : "MEMBRE");

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
            <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
                    <tr><td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;">Medianet Incubateur</h1>
                      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px;">Invitation à rejoindre la plateforme</p>
                    </td></tr>
                    <tr><td style="padding:40px;">
                      <div style="display:inline-block;background:#1a73e8;color:#fff;padding:6px 14px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px;">
                        %s
                      </div>
                      <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">%s</h2>
                      %s
                      <p style="color:#444;font-size:15px;line-height:1.7;margin:24px 0 8px;">Bonjour <strong>%s</strong>,</p>
                      <div style="color:#444;font-size:15px;line-height:1.8;white-space:pre-wrap;margin-bottom:32px;">%s</div>
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr><td>
                          <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#1a73e8,#0d47a1);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:.3px;">
                            Créer mon compte
                          </a>
                        </td></tr>
                      </table>
                      <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
                        Ce lien est personnel. Il ouvre une page où vous choisirez votre mot de passe pour finaliser l'inscription.
                      </p>
                    </td></tr>
                    <tr><td style="background:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #e8ecef;">
                      <p style="color:#888;font-size:12px;margin:0;">© 2026 Medianet Incubateur · Tous droits réservés</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """.formatted(roleLabel, inv.getSubject(), context, name, inv.getMessage(), registerUrl);
    }

    private String roleLabel(String type) {
        return switch (type.toUpperCase()) {
            case "JURY"    -> "Invitation Jury";
            case "MENTOR"  -> "Invitation Mentor";
            case "PORTEUR" -> "Invitation Porteur";
            case "ADMIN"   -> "Invitation Administrateur";
            default        -> "Invitation";
        };
    }

    private String buildContextLine(Invitation inv) {
        if (inv.getProgrammeName() == null) return "";
        StringBuilder sb = new StringBuilder(
            "<p style=\"color:#1a73e8;font-size:13px;font-weight:600;margin:0 0 20px;\">");
        sb.append("Programme : ").append(inv.getProgrammeName());
        if (inv.getPhaseName() != null) sb.append(" · Phase : ").append(inv.getPhaseName());
        sb.append("</p>");
        return sb.toString();
    }
}
