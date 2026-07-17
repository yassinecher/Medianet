package com.medianet.programme.service;

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

import java.util.List;

/**
 * Reads, from notification-service, the set of session (phase) ids the current
 * caller was explicitly invited to. Used to let invited (but non-privileged)
 * users see HIDDEN/PRIVATE sessions. Fails open (empty list) so a notification
 * outage never blocks session listing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InvitationLookup {

    private final RestTemplate restTemplate;

    @Value("${NOTIFICATION_SERVICE_URL:http://notification-service:8087}")
    private String notificationUrl;

    public List<Long> invitedPhaseIds() {
        return fetchIds("/api/notifications/invitations/my-phases", "invitedPhaseIds");
    }

    /** Programme ids the caller was invited to (resolved server-side from the
     *  caller's own token, so it can't be spoofed). Fails open to empty. */
    public List<Long> invitedProgrammeIds() {
        return fetchIds("/api/notifications/invitations/my-programmes", "invitedProgrammeIds");
    }

    private List<Long> fetchIds(String path, String label) {
        String authz = currentAuthorizationHeader();
        if (authz == null) return List.of();   // anonymous → no invitations
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, authz);
            var resp = restTemplate.exchange(
                    notificationUrl + path,
                    HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Long>>() {});
            List<Long> body = resp.getBody();
            return body != null ? body : List.of();
        } catch (Exception e) {
            log.warn("{} lookup failed — defaulting to none: {}", label, e.getMessage());
            return List.of();
        }
    }

    private String currentAuthorizationHeader() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) {
            return sra.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        }
        return null;
    }
}
