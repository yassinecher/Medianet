package com.medianet.programme.service;

import com.medianet.programme.entity.CanvaToken;
import com.medianet.programme.repository.CanvaTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Canva Connect API integration (server-side ONLY — the client secret and the
 * OAuth tokens never reach the browser).
 *
 * Flow: the studio asks for an authorize URL (PKCE), the admin approves in a
 * popup, Canva redirects to our callback which stores the tokens; afterwards
 * « Envoyer vers Canva » uploads the generated .pptx to Canva's design-import
 * endpoint and returns the edit URL of the created design.
 *
 * Configured via env: CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REDIRECT_URI.
 * When unconfigured every endpoint reports it and the studio falls back to the
 * manual « download + import in Canva » flow.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CanvaService {

    private final CanvaTokenRepository tokenRepository;
    private final RestTemplate restTemplate;

    @Value("${CANVA_CLIENT_ID:}")
    private String clientId;
    @Value("${CANVA_CLIENT_SECRET:}")
    private String clientSecret;
    /** Must EXACTLY match one of the redirect URLs declared on canva.dev.
     *  NB: Canva's portal refuses « localhost » — use 127.0.0.1 for local dev. */
    @Value("${CANVA_REDIRECT_URI:http://127.0.0.1:8080/api/canva/callback}")
    private String redirectUri;

    private static final String AUTH_URL  = "https://www.canva.com/api/oauth/authorize";
    private static final String TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
    private static final String IMPORT_URL = "https://api.canva.com/rest/v1/imports";
    private static final String SCOPES = "design:content:write design:meta:read";

    /** state → {verifier, email, createdAt} — PKCE flows pending approval. */
    private final Map<String, String[]> pending = new ConcurrentHashMap<>();

    public boolean configured() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    @Transactional(readOnly = true)
    public boolean connected(String email) {
        return email != null && tokenRepository.findByUserEmail(email).isPresent();
    }

    /** Build the PKCE authorize URL for this user (opened in a popup). */
    public String authorizeUrl(String email) {
        if (!configured()) throw new IllegalStateException("Canva n'est pas configuré (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET).");
        SecureRandom rnd = new SecureRandom();
        byte[] v = new byte[48]; rnd.nextBytes(v);
        String verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(v);
        String challenge = s256(verifier);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(rnd.generateSeed(18));
        pending.put(state, new String[]{ verifier, email, String.valueOf(System.currentTimeMillis()) });
        pending.entrySet().removeIf(e -> System.currentTimeMillis() - Long.parseLong(e.getValue()[2]) > 15 * 60_000);
        return AUTH_URL
                + "?code_challenge=" + challenge
                + "&code_challenge_method=s256"
                + "&response_type=code"
                + "&client_id=" + clientId
                + "&state=" + state
                + "&scope=" + url(SCOPES)
                + "&redirect_uri=" + url(redirectUri);
    }

    /** OAuth callback: exchange the code, store the tokens for the user. */
    public void handleCallback(String state, String code) {
        String[] p = state != null ? pending.remove(state) : null;
        if (p == null) throw new IllegalStateException("Session d'autorisation expirée — relancez la connexion Canva.");
        Map<String, Object> resp = tokenCall(form(Map.of(
                "grant_type", "authorization_code",
                "code", code,
                "code_verifier", p[0],
                "redirect_uri", redirectUri)));
        saveTokens(p[1], resp);
    }

    /** Valid access token for the user — refreshed transparently when expired. */
    public String accessTokenFor(String email) {
        CanvaToken t = tokenRepository.findByUserEmail(email)
                .orElseThrow(() -> new IllegalStateException("Compte Canva non connecté."));
        if (t.getExpiresAt() != null && t.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(2)))
            return t.getAccessToken();
        // Refresh (Canva rotates refresh tokens — always store the new one).
        Map<String, Object> resp = tokenCall(form(Map.of(
                "grant_type", "refresh_token",
                "refresh_token", t.getRefreshToken())));
        saveTokens(email, resp);
        return String.valueOf(resp.get("access_token"));
    }

    public void disconnect(String email) {
        tokenRepository.findByUserEmail(email).ifPresent(tokenRepository::delete);
    }

    /**
     * Upload a generated .pptx as a new Canva design (async import job, polled
     * to completion). Returns the design EDIT url to open in a new tab.
     */
    public String importPptx(String email, String title, byte[] pptx) {
        String token = accessTokenFor(email);

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        h.set("Import-Metadata", "{\"title_base64\":\""
                + Base64.getEncoder().encodeToString((title == null ? "Présentation" : title).getBytes(StandardCharsets.UTF_8))
                + "\",\"mime_type\":\"application/vnd.openxmlformats-officedocument.presentationml.presentation\"}");

        ResponseEntity<Map<String, Object>> created = restTemplate.exchange(
                IMPORT_URL, HttpMethod.POST, new HttpEntity<>(pptx, h),
                new org.springframework.core.ParameterizedTypeReference<>() {});
        Map<String, Object> job = asMap(created.getBody() == null ? null : created.getBody().get("job"));
        String jobId = job == null ? null : String.valueOf(job.get("id"));
        if (jobId == null) throw new IllegalStateException("Canva n'a pas accepté l'import.");

        // Poll the job (imports are quick; cap at ~45 s).
        HttpHeaders ph = new HttpHeaders(); ph.setBearerAuth(token);
        for (int i = 0; i < 30; i++) {
            try { Thread.sleep(1500); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
            ResponseEntity<Map<String, Object>> st = restTemplate.exchange(
                    IMPORT_URL + "/" + jobId, HttpMethod.GET, new HttpEntity<>(ph),
                    new org.springframework.core.ParameterizedTypeReference<>() {});
            Map<String, Object> j = asMap(st.getBody() == null ? null : st.getBody().get("job"));
            String status = j == null ? null : String.valueOf(j.get("status"));
            if ("success".equalsIgnoreCase(status)) {
                Map<String, Object> result = asMap(j.get("result"));
                Object designs = result == null ? null : result.get("designs");
                if (designs instanceof java.util.List<?> list && !list.isEmpty()) {
                    Map<String, Object> d = asMap(list.get(0));
                    Map<String, Object> urls = d == null ? null : asMap(d.get("urls"));
                    if (urls != null && urls.get("edit_url") != null) return String.valueOf(urls.get("edit_url"));
                    if (d != null && d.get("id") != null) return "https://www.canva.com/design/" + d.get("id") + "/edit";
                }
                throw new IllegalStateException("Import terminé mais sans design retourné.");
            }
            if ("failed".equalsIgnoreCase(status)) {
                Map<String, Object> err = j == null ? null : asMap(j.get("error"));
                throw new IllegalStateException("Import Canva échoué"
                        + (err != null && err.get("message") != null ? " : " + err.get("message") : "."));
            }
        }
        throw new IllegalStateException("Import Canva trop long — réessayez.");
    }

    // ── internals ───────────────────────────────────────────────────────────

    private Map<String, Object> tokenCall(MultiValueMap<String, String> body) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        h.setBasicAuth(clientId, clientSecret);
        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                TOKEN_URL, HttpMethod.POST, new HttpEntity<>(body, h),
                new org.springframework.core.ParameterizedTypeReference<>() {});
        if (resp.getBody() == null || resp.getBody().get("access_token") == null)
            throw new IllegalStateException("Échange de jeton Canva refusé.");
        return resp.getBody();
    }

    private void saveTokens(String email, Map<String, Object> resp) {
        CanvaToken t = tokenRepository.findByUserEmail(email).orElseGet(() -> CanvaToken.builder().userEmail(email).build());
        t.setAccessToken(String.valueOf(resp.get("access_token")));
        if (resp.get("refresh_token") != null) t.setRefreshToken(String.valueOf(resp.get("refresh_token")));
        long expiresIn = resp.get("expires_in") instanceof Number n ? n.longValue() : 3600L;
        t.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
        tokenRepository.save(t);
        log.info("Canva tokens stored for {}", email);
    }

    private static MultiValueMap<String, String> form(Map<String, String> m) {
        MultiValueMap<String, String> f = new LinkedMultiValueMap<>();
        m.forEach(f::add);
        return f;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private static String s256(String verifier) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(md.digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static String url(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
