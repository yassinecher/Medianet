package com.medianet.programme.service;

import com.medianet.programme.entity.Programme;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.*;

/**
 * Notifies the people subscribed to a programme when a <b>critical</b> change
 * happens to it (status change, dates moved, deadline changed, archived/deleted).
 *
 * <p>Audience = accepted participants (candidature-service) + invited contributors
 * such as jury and mentors (notification-service). Delivery reuses the existing
 * bulk-invite endpoint, which both e-mails each recipient and archives a row that
 * doubles as the in-app record — so no new endpoint is needed in either service.
 *
 * <p>Entirely best-effort: any failure is logged and swallowed. Notifying
 * contributors must never block or fail a programme update.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ContributorNotifier {

    private final RestTemplate restTemplate;

    @Value("${NOTIFICATION_SERVICE_URL:http://notification-service:8087}")
    private String notificationUrl;
    @Value("${CANDIDATURE_SERVICE_URL:http://candidature-service:8083}")
    private String candidatureUrl;

    /** Fire a notification for a critical change. Best-effort and fail-open — never
     *  blocks or fails the update, even if both downstream services are unreachable. */
    public void notifyCriticalChange(Programme p, String changeType, String summary) {
        try {
            String authz = currentAuthorizationHeader();
            if (authz == null) return;   // no caller context → nothing we can authenticate with

            // 1) Gather recipients from both services (best-effort, deduped by email).
            Map<String, String> recipients = new LinkedHashMap<>();   // email -> name
            collectAcceptedParticipants(p.getId(), authz, recipients);
            collectInvitedContributors(p.getId(), authz, recipients);
            if (recipients.isEmpty()) {
                log.info("Programme {} critical change ({}) — no subscribed contributors to notify", p.getId(), changeType);
                return;
            }

            // 2) Send via the existing bulk-invite endpoint (email + archived record).
            String title = p.getTitle() != null ? p.getTitle() : ("Programme #" + p.getId());
            List<Map<String, Object>> recipientList = new ArrayList<>();
            recipients.forEach((email, name) -> {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("email", email);
                if (name != null && !name.isBlank()) r.put("name", name);
                recipientList.add(r);
            });
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("type", "GENERAL");
            body.put("programmeId", p.getId());
            body.put("programmeName", title);
            body.put("subject", "Mise à jour importante — " + title);
            body.put("message", summary);
            body.put("requiresRsvp", false);
            body.put("recipients", recipientList);

            HttpHeaders headers = jsonHeaders(authz);
            restTemplate.exchange(notificationUrl + "/api/notifications/invitations/bulk",
                    HttpMethod.POST, new HttpEntity<>(body, headers), new ParameterizedTypeReference<Object>() {});
            log.info("Programme {} critical change ({}) — notified {} contributor(s)", p.getId(), changeType, recipientList.size());
        } catch (Exception e) {
            log.warn("Programme {} contributor notification failed ({}): {}", p.getId(), changeType, e.getMessage());
        }
    }

    private void collectAcceptedParticipants(Long programmeId, String authz, Map<String, String> out) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(jsonHeaders(authz));
            var resp = restTemplate.exchange(
                    candidatureUrl + "/api/candidatures/programme/" + programmeId + "?status=ACCEPTED",
                    HttpMethod.GET, req, new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            for (Map<String, Object> c : Optional.ofNullable(resp.getBody()).orElse(List.of())) {
                String email = str(c.get("carrierEmail"));
                if (email == null) email = str(c.get("porteurEmail"));
                if (email != null) out.putIfAbsent(email.toLowerCase(), str(c.get("carrierName")));
            }
        } catch (Exception e) {
            log.warn("accepted-participants lookup failed for programme {}: {}", programmeId, e.getMessage());
        }
    }

    private void collectInvitedContributors(Long programmeId, String authz, Map<String, String> out) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(jsonHeaders(authz));
            var resp = restTemplate.exchange(
                    notificationUrl + "/api/notifications/invitations/programme/" + programmeId,
                    HttpMethod.GET, req, new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            for (Map<String, Object> i : Optional.ofNullable(resp.getBody()).orElse(List.of())) {
                if ("DECLINED".equalsIgnoreCase(str(i.get("status")))) continue;
                String email = str(i.get("recipientEmail"));
                if (email != null) out.putIfAbsent(email.toLowerCase(), str(i.get("recipientName")));
            }
        } catch (Exception e) {
            log.warn("invited-contributors lookup failed for programme {}: {}", programmeId, e.getMessage());
        }
    }

    private HttpHeaders jsonHeaders(String authz) {
        HttpHeaders h = new HttpHeaders();
        h.set(HttpHeaders.AUTHORIZATION, authz);
        h.set(HttpHeaders.CONTENT_TYPE, "application/json");
        return h;
    }

    private String currentAuthorizationHeader() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra)
            return sra.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        return null;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }
}
