package com.medianet.candidature.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.HandlerMethod;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    /** The HandlerMethod is injected so the 403 can name the missing permission. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex, @Nullable HandlerMethod handlerMethod) {
        String required = requiredAuthority(handlerMethod);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", required != null
                ? "Accès refusé — permission requise : " + required
                : "Accès refusé : permission insuffisante.");
        if (required != null) body.put("requiredPermission", required);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    private static final Pattern AUTHORITY = Pattern.compile("has(?:Authority|Role)\\('([^']+)'\\)");

    @Nullable
    private static String requiredAuthority(@Nullable HandlerMethod handlerMethod) {
        if (handlerMethod == null) return null;
        PreAuthorize pre = handlerMethod.getMethodAnnotation(PreAuthorize.class);
        if (pre == null) pre = handlerMethod.getBeanType().getAnnotation(PreAuthorize.class);
        if (pre == null) return null;
        Matcher m = AUTHORITY.matcher(pre.value());
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            if (sb.length() > 0) sb.append(" ou ");
            sb.append(m.group(1));
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    @ExceptionHandler(InsufficientAuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleUnauthenticated(InsufficientAuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Authentication required"));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", ex.getMessage()));
    }
}
