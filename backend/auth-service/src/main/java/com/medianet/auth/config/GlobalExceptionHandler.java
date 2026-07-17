package com.medianet.auth.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.HandlerMethod;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
    }

    /**
     * @PreAuthorize denials surface as AccessDeniedException (Spring Security 6's
     * AuthorizationDeniedException extends it). Without this handler the catch-all
     * RuntimeException mapper below would turn an authorization failure into a 500.
     *
     * <p>The {@link HandlerMethod} that raised the denial is injected so the
     * response can NAME the missing permission (parsed from its @PreAuthorize
     * expression) — the frontends show it to the user.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex, @Nullable HandlerMethod handlerMethod) {
        // Guard-thrown denials (e.g. "only an admin may grant admin permissions")
        // carry a specific business message — pass it through. @PreAuthorize
        // denials use the stock "Access Denied" and fall through to the
        // missing-permission introspection.
        String msg = ex.getMessage();
        if (msg != null && !msg.isBlank() && !"Access Denied".equals(msg)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", msg));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(accessDeniedBody(handlerMethod));
    }

    /** Builds {error, requiredPermission?} from the handler's @PreAuthorize expression. */
    static Map<String, Object> accessDeniedBody(@Nullable HandlerMethod handlerMethod) {
        Map<String, Object> body = new LinkedHashMap<>();
        String required = requiredAuthority(handlerMethod);
        if (required != null) {
            body.put("error", "Accès refusé — permission requise : " + required);
            body.put("requiredPermission", required);
        } else {
            body.put("error", "Accès refusé : permission insuffisante.");
        }
        return body;
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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", ex.getMessage()));
    }
}
