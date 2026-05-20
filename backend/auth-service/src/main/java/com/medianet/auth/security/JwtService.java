package com.medianet.auth.security;

import com.medianet.auth.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration:86400000}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId",      user.getId());
        // Multi-role: embed full set of role names
        claims.put("roles",       new ArrayList<>(user.getRoleNames()));
        // Primary role for backward compat
        claims.put("role",        user.getPrimaryRole());
        // Effective permissions (role-inherited + direct)
        claims.put("permissions", new ArrayList<>(user.getAllPermissionSlugs()));
        claims.put("firstName",   user.getFirstName());
        claims.put("lastName",    user.getLastName());

        return Jwts.builder()
                .claims(claims)
                .subject(user.getEmail())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        return extractAllClaims(token).get("userId", Long.class);
    }

    /** Primary role (backward compat) */
    public String extractRole(String token) {
        return extractAllClaims(token).get("role", String.class);
    }

    @SuppressWarnings("unchecked")
    public Set<String> extractRoles(String token) {
        Object raw = extractAllClaims(token).get("roles");
        if (raw instanceof List<?> list) {
            Set<String> result = new HashSet<>();
            for (Object item : list) result.add(String.valueOf(item));
            return result;
        }
        // fallback: single role claim
        String single = extractRole(token);
        return single != null ? Set.of(single) : Set.of();
    }

    @SuppressWarnings("unchecked")
    public Set<String> extractPermissions(String token) {
        Object raw = extractAllClaims(token).get("permissions");
        if (raw instanceof List<?> list) {
            Set<String> result = new HashSet<>();
            for (Object item : list) result.add(String.valueOf(item));
            return result;
        }
        return Set.of();
    }

    public boolean isTokenValid(String token) {
        try {
            return extractAllClaims(token).getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
