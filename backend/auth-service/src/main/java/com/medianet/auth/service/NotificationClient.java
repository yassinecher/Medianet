package com.medianet.auth.service;

import com.medianet.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Lightweight HTTP client for talking to notification-service.
 * Used by auth-service when a recipient finishes account creation from an invitation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationClient {

    private final RestTemplate restTemplate;
    private final JwtService jwtService;

    @Value("${notification.service.url:http://notification-service:8087}")
    private String notificationServiceUrl;

    /**
     * Send an email via notification-service (which gates the endpoint behind
     * ADMIN). auth-service mints a short-lived system token so trusted internal
     * flows (e.g. org-member invitations) can send without a user being admin.
     * Best-effort: never throws to the caller.
     */
    public void sendEmail(String toEmail, String toName, String subject, String htmlBody) {
        String url = notificationServiceUrl + "/api/notifications/email/send";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(jwtService.generateServiceToken());
            Map<String, Object> body = new HashMap<>();
            body.put("toEmail", toEmail);
            body.put("toName", toName);
            body.put("subject", subject);
            body.put("body", htmlBody);
            body.put("html", true);
            restTemplate.postForObject(url, new HttpEntity<>(body, headers), Object.class);
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }

    /**
     * Fetch an invitation by its public token.
     * <p>Returns a {@link Map} so we don't need to share DTO classes across services.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getInvitationByToken(String token) {
        String url = notificationServiceUrl + "/api/notifications/invitations/token/" + token;
        try {
            Map<String, Object> body = restTemplate.getForObject(url, Map.class);
            if (body == null) throw new IllegalArgumentException("Invitation not found");
            return body;
        } catch (Exception e) {
            log.error("Failed to fetch invitation {}: {}", token, e.getMessage());
            throw new IllegalArgumentException("Invalid or expired invitation token");
        }
    }

    /** Mark an invitation as ACCEPTED — best-effort. */
    public void markAccepted(String token) {
        String url = notificationServiceUrl + "/api/notifications/invitations/" + token + "/accept";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.exchange(url, HttpMethod.PATCH, new HttpEntity<>(headers), Object.class);
        } catch (Exception e) {
            log.warn("Could not mark invitation accepted {}: {}", token, e.getMessage());
        }
    }

    @Configuration
    static class RestTemplateConfig {
        @Bean
        public RestTemplate notificationRestTemplate() {
            return new RestTemplate();
        }
    }
}
