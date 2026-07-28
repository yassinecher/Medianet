package com.medianet.auth.dto;

import lombok.Data;

/**
 * Body of {@code POST /api/auth/google}. Google Identity Services returns the ID
 * token in a field called {@code credential}; we accept either name so the
 * frontend can send whichever is convenient.
 */
@Data
public class GoogleLoginRequest {
    private String idToken;
    private String credential;

    /** The ID token, whichever field it arrived in. */
    public String token() {
        if (idToken != null && !idToken.isBlank()) return idToken;
        return credential;
    }
}
