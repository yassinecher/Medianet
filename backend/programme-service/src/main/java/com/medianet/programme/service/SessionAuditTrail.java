package com.medianet.programme.service;

import com.medianet.programme.entity.ProgrammePhase;
import com.medianet.programme.entity.SessionAuditLog;
import com.medianet.programme.repository.SessionAuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Writes the session update history (account + IP + change summary). Entirely
 * best-effort: an audit failure must never block or fail the actual operation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionAuditTrail {

    private final SessionAuditLogRepository repository;

    /** Record an action on a session. {@code details} may be null (e.g. creation). */
    public void record(Long programmeId, Long sessionId, String sessionTitle,
                       String action, String details) {
        try {
            repository.save(SessionAuditLog.builder()
                    .programmeId(programmeId)
                    .sessionId(sessionId)
                    .sessionTitle(sessionTitle)
                    .action(action)
                    .userEmail(currentUserEmail())
                    .ipAddress(currentIp())
                    .details(details)
                    .build());
        } catch (Exception e) {
            log.warn("session audit write failed ({} on session {}): {}", action, sessionId, e.getMessage());
        }
    }

    /** Convenience overload. */
    public void record(ProgrammePhase phase, String action, String details) {
        record(phase.getProgramme() != null ? phase.getProgramme().getId() : null,
                phase.getId(), phase.getTitle(), action, details);
    }

    private String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return null;
        String name = String.valueOf(auth.getPrincipal());
        return "anonymousUser".equals(name) ? null : name;
    }

    /** First X-Forwarded-For hop (real client behind the gateway), else remote addr. */
    private String currentIp() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes sra)) return null;
        HttpServletRequest req = sra.getRequest();
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        return req.getRemoteAddr();
    }
}
