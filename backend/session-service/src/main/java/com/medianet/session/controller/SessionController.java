package com.medianet.session.controller;

import com.medianet.session.dto.*;
import com.medianet.session.entity.SessionStatus;
import com.medianet.session.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @GetMapping
    public ResponseEntity<List<SessionDto>> getSessions(
            @RequestParam(required = false) SessionStatus status) {
        return ResponseEntity.ok(sessionService.getSessions(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionDto> getSession(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.getSessionById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDto> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            HttpServletRequest httpRequest) {
        Long adminId = (Long) httpRequest.getAttribute("userId");
        String adminName = (String) httpRequest.getAttribute("userFirstName");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.createSession(request, adminId, adminName != null ? adminName : "Admin"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDto> updateSession(
            @PathVariable Long id,
            @RequestBody UpdateSessionRequest request,
            HttpServletRequest httpRequest) {
        Long adminId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(sessionService.updateSession(id, request, adminId));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDto> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody SessionStatusRequest request) {
        return ResponseEntity.ok(sessionService.changeStatus(id, request.getStatus()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(sessionService.getStats());
    }
}
