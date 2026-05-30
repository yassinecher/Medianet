package com.medianet.programme.controller;

import com.medianet.programme.dto.*;
import com.medianet.programme.service.ProgrammeService;
import com.medianet.programme.service.SessionDayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST surface for the unified Session model.
 *
 * <p>{@code /sessions} is a thin alias over {@code /phases} so the legacy
 * frontend keeps working while the new UI switches to the session vocabulary.
 * Days + activities are exposed under each session.
 */
@RestController
@RequestMapping("/api/programmes/{programmeId}")
@RequiredArgsConstructor
public class SessionController {

    private final ProgrammeService  programmeService;
    private final SessionDayService sessionDayService;

    // ── Sessions (alias for phases) ──────────────────────────────────────────

    @GetMapping("/sessions")
    public ResponseEntity<List<ProgrammePhaseDto>> listSessions(@PathVariable Long programmeId) {
        return ResponseEntity.ok(programmeService.getPhases(programmeId));
    }

    @PostMapping("/sessions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgrammePhaseDto> createSession(
            @PathVariable Long programmeId,
            @Valid @RequestBody CreatePhaseRequest req) {
        return ResponseEntity.status(201).body(programmeService.addPhase(programmeId, req));
    }

    @PutMapping("/sessions/{sessionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgrammePhaseDto> updateSession(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @RequestBody UpdatePhaseRequest req) {
        return ResponseEntity.ok(programmeService.updatePhase(programmeId, sessionId, req));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteSession(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId) {
        programmeService.deletePhase(programmeId, sessionId);
        return ResponseEntity.noContent().build();
    }

    // ── Days ─────────────────────────────────────────────────────────────────

    @GetMapping("/sessions/{sessionId}/days")
    public ResponseEntity<List<SessionDayDto>> listDays(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionDayService.listDays(programmeId, sessionId));
    }

    @PostMapping("/sessions/{sessionId}/days")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDayDto> addDay(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @Valid @RequestBody CreateSessionDayRequest req) {
        return ResponseEntity.status(201).body(sessionDayService.addDay(programmeId, sessionId, req));
    }

    @PutMapping("/sessions/{sessionId}/days/{dayId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDayDto> updateDay(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @PathVariable Long dayId,
            @RequestBody UpdateSessionDayRequest req) {
        return ResponseEntity.ok(sessionDayService.updateDay(programmeId, sessionId, dayId, req));
    }

    @DeleteMapping("/sessions/{sessionId}/days/{dayId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteDay(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @PathVariable Long dayId) {
        sessionDayService.deleteDay(programmeId, sessionId, dayId);
        return ResponseEntity.noContent().build();
    }

    // ── Activities ───────────────────────────────────────────────────────────

    @PostMapping("/sessions/{sessionId}/days/{dayId}/activities")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionActivityDto> addActivity(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @PathVariable Long dayId,
            @Valid @RequestBody CreateSessionActivityRequest req) {
        return ResponseEntity.status(201)
                .body(sessionDayService.addActivity(programmeId, sessionId, dayId, req));
    }

    @PutMapping("/sessions/{sessionId}/days/{dayId}/activities/{activityId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionActivityDto> updateActivity(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @PathVariable Long dayId,
            @PathVariable Long activityId,
            @RequestBody UpdateSessionActivityRequest req) {
        return ResponseEntity.ok(
                sessionDayService.updateActivity(programmeId, sessionId, dayId, activityId, req));
    }

    @DeleteMapping("/sessions/{sessionId}/days/{dayId}/activities/{activityId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteActivity(
            @PathVariable Long programmeId,
            @PathVariable Long sessionId,
            @PathVariable Long dayId,
            @PathVariable Long activityId) {
        sessionDayService.deleteActivity(programmeId, sessionId, dayId, activityId);
        return ResponseEntity.noContent().build();
    }
}
