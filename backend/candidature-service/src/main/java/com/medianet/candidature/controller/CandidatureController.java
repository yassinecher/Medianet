package com.medianet.candidature.controller;

import com.medianet.candidature.dto.*;
import com.medianet.candidature.entity.CandidatureStatus;
import com.medianet.candidature.service.CandidatureService;
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
@RequestMapping("/api/candidatures")
@RequiredArgsConstructor
public class CandidatureController {

    private final CandidatureService candidatureService;

    // ── Submit ────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('PORTEUR')")
    public ResponseEntity<CandidatureDto> submit(
            @Valid @RequestBody SubmitCandidatureRequest request,
            HttpServletRequest httpRequest) {
        Long porteurId    = (Long)   httpRequest.getAttribute("userId");
        String porteurEmail = (String) httpRequest.getAttribute("userEmail");
        String firstName  = (String) httpRequest.getAttribute("userFirstName");
        String lastName   = (String) httpRequest.getAttribute("userLastName");
        String porteurName = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(candidatureService.submitCandidature(request, porteurId, porteurEmail, porteurName));
    }

    // ── List / Get ────────────────────────────────────────────────────────────

    /** All candidatures — admin/jury, optionally filtered by ?status= */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update') or hasAuthority('candidatures:read') or hasRole('JURY')")
    public ResponseEntity<List<CandidatureDto>> getAll(
            @RequestParam(required = false) CandidatureStatus status) {
        return ResponseEntity.ok(candidatureService.getAllCandidatures(status));
    }

    /** Candidatures for a specific programme — admin/jury */
    @GetMapping("/programme/{programmeId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update') or hasAuthority('candidatures:read') or hasRole('JURY')")
    public ResponseEntity<List<CandidatureDto>> getByProgramme(
            @PathVariable Long programmeId,
            @RequestParam(required = false) CandidatureStatus status) {
        return ResponseEntity.ok(candidatureService.getCandidaturesByProgramme(programmeId, status));
    }

    /** Per-programme stats — admin only */
    @GetMapping("/programme/{programmeId}/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update') or hasAuthority('candidatures:read')")
    public ResponseEntity<Map<String, Long>> getProgrammeStats(@PathVariable Long programmeId) {
        return ResponseEntity.ok(candidatureService.getProgrammeStats(programmeId));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('PORTEUR')")
    public ResponseEntity<List<CandidatureDto>> getMy(HttpServletRequest httpRequest) {
        Long porteurId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(candidatureService.getMyCandidatures(porteurId));
    }

    @GetMapping("/my-jury-assignments")
    @PreAuthorize("hasRole('JURY')")
    public ResponseEntity<List<CandidatureDto>> getMyJuryAssignments(HttpServletRequest httpRequest) {
        Long juryId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(candidatureService.getMyJuryAssignments(juryId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CandidatureDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(candidatureService.getCandidatureById(id));
    }

    // ── Jury assignment ───────────────────────────────────────────────────────

    @PostMapping("/{id}/assign-jury")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureDto> assignJury(
            @PathVariable Long id,
            @Valid @RequestBody AssignJuryRequest request) {
        return ResponseEntity.ok(candidatureService.assignJury(id, request));
    }

    /** Change the jury: remove a single assignment (others keep their tokens). */
    @DeleteMapping("/{id}/jury/{assignmentId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureDto> removeJury(
            @PathVariable Long id,
            @PathVariable Long assignmentId) {
        return ResponseEntity.ok(candidatureService.removeJuryAssignment(id, assignmentId));
    }

    // ── Evaluate ──────────────────────────────────────────────────────────────

    @PostMapping("/{id}/evaluate")
    @PreAuthorize("hasRole('JURY') or hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureDto> evaluate(
            @PathVariable Long id,
            @Valid @RequestBody EvaluationRequest request,
            HttpServletRequest httpRequest) {
        Long juryId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(candidatureService.evaluateCandidature(id, juryId, request));
    }

    // ── Token-based evaluation (public, no login — jury opens the email link) ───

    @GetMapping("/evaluate/{token}")
    public ResponseEntity<TokenEvaluationDto> getEvaluationByToken(@PathVariable String token) {
        return ResponseEntity.ok(candidatureService.getEvaluationByToken(token));
    }

    @PostMapping("/evaluate/{token}")
    public ResponseEntity<TokenEvaluationDto> submitEvaluationByToken(
            @PathVariable String token,
            @Valid @RequestBody EvaluationRequest request) {
        return ResponseEntity.ok(candidatureService.submitEvaluationByToken(token, request));
    }

    // ── Accept / Reject ───────────────────────────────────────────────────────

    @PatchMapping("/{id}/accept")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureDto> accept(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        Long adminId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(candidatureService.acceptCandidature(id, adminId));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureDto> reject(
            @PathVariable Long id,
            @RequestBody AcceptRejectRequest request,
            HttpServletRequest httpRequest) {
        Long adminId = (Long) httpRequest.getAttribute("userId");
        return ResponseEntity.ok(candidatureService.rejectCandidature(id, request.getReason(), adminId));
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update') or hasAuthority('candidatures:read')")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(candidatureService.getStats());
    }
}
