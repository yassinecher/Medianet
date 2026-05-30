package com.medianet.adminai.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Generic HTTP client used to call programme/auth/notification services.
 *
 * <p>All AI-initiated requests piggyback on the admin's own JWT (passed in
 * via the controller) so the upstream service's @PreAuthorize("hasRole('ADMIN')")
 * still applies. The AI cannot grant itself privileges.
 */
@Service
@Slf4j
public class UpstreamClient {

    @Value("${services.programme-url:http://programme-service:8086}")    private String programmeUrl;
    @Value("${services.auth-url:http://auth-service:8081}")              private String authUrl;
    @Value("${services.candidature-url:http://candidature-service:8083}") private String candidatureUrl;
    @Value("${services.notification-url:http://notification-service:8087}") private String notificationUrl;

    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public String programme()    { return programmeUrl; }
    public String auth()         { return authUrl; }
    public String candidature()  { return candidatureUrl; }
    public String notification() { return notificationUrl; }

    public Object get(String url, String adminToken) {
        return send("GET", url, null, adminToken);
    }

    public Object post(String url, Object body, String adminToken) {
        return send("POST", url, body, adminToken);
    }

    public Object put(String url, Object body, String adminToken) {
        return send("PUT", url, body, adminToken);
    }

    public Object patch(String url, Object body, String adminToken) {
        return send("PATCH", url, body, adminToken);
    }

    public Object delete(String url, String adminToken) {
        return send("DELETE", url, null, adminToken);
    }

    private Object send(String method, String url, Object body, String adminToken) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + adminToken);

            byte[] payload = body == null ? new byte[0] : json.writeValueAsBytes(body);

            switch (method) {
                case "GET"    -> b.GET();
                case "DELETE" -> b.DELETE();
                default       -> b.method(method, HttpRequest.BodyPublishers.ofByteArray(payload))
                                   .header("Content-Type", "application/json");
            }

            HttpResponse<String> resp = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 400) {
                log.warn("Upstream {} {} -> {} {}", method, url, resp.statusCode(), resp.body());
                throw new RuntimeException("Upstream " + resp.statusCode() + ": " + resp.body());
            }
            if (resp.body() == null || resp.body().isBlank()) return Map.of("status", "ok");
            return json.readValue(resp.body(), new TypeReference<>() {});
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("Upstream call failed: " + e.getMessage(), e);
        }
    }

    public static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
