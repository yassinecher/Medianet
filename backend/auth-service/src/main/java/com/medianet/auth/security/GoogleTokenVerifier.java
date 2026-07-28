package com.medianet.auth.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Verifies a Google Identity Services ID token (the JWT that the "Sign in with
 * Google" button hands the browser). The Google client library checks the
 * signature against Google's rotating public certs, plus the issuer, expiry, and
 * that the audience matches OUR client id — so a token minted for another site
 * is rejected.
 *
 * <p>Only the PUBLIC client id is required (as the audience). There is NO client
 * secret here, because this flow never exchanges an authorization code.
 */
@Component
@Slf4j
public class GoogleTokenVerifier {

    private final String clientId;
    private volatile GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${google.client-id:}") String clientId) {
        this.clientId = clientId == null ? "" : clientId.trim();
        if (this.clientId.isBlank()) {
            log.info("Google Sign-In disabled — no google.client-id (GOOGLE_CLIENT_ID) set.");
        }
    }

    public boolean isConfigured() {
        return !clientId.isBlank();
    }

    /** Verify the token and return its claims, or throw a user-facing exception. */
    public GoogleIdToken.Payload verify(String idTokenString) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                "La connexion Google n'est pas configurée sur le serveur (GOOGLE_CLIENT_ID manquant).");
        }
        if (idTokenString == null || idTokenString.isBlank()) {
            throw new IllegalArgumentException("Jeton Google manquant.");
        }
        try {
            GoogleIdToken token = verifier().verify(idTokenString);
            if (token == null) {
                // Bad signature, wrong audience, expired, or wrong issuer.
                throw new IllegalArgumentException("Jeton Google invalide ou expiré.");
            }
            return token.getPayload();
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google token verification error: {}", e.getMessage());
            throw new IllegalArgumentException("Échec de la vérification du jeton Google.");
        }
    }

    // Built lazily so the service starts fine even when Google Sign-In is off.
    private GoogleIdTokenVerifier verifier() {
        GoogleIdTokenVerifier v = verifier;
        if (v == null) {
            synchronized (this) {
                if (verifier == null) {
                    verifier = new GoogleIdTokenVerifier.Builder(
                            new NetHttpTransport(), GsonFactory.getDefaultInstance())
                            .setAudience(Collections.singletonList(clientId))
                            .build();
                }
                v = verifier;
            }
        }
        return v;
    }
}
