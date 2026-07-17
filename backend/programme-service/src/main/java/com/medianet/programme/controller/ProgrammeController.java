package com.medianet.programme.controller;

import com.medianet.programme.dto.*;
import com.medianet.programme.service.ProgrammeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/programmes")
@RequiredArgsConstructor
public class ProgrammeController {

    private final ProgrammeService programmeService;

    // ── Programme CRUD ────────────────────────────────────────────────────────

    /**
     * List programmes — public endpoint.
     * Supports optional ?status=OPEN&type=PUBLIC filters.
     * <p>{@code publicOnly=true} (used by the front-office) hides programmes that
     * should not be visible to porteurs: DRAFT, ARCHIVED and CANCELLED.
     */
    @GetMapping
    public ResponseEntity<List<ProgrammeDto>> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false, defaultValue = "false") boolean publicOnly) {
        return ResponseEntity.ok(programmeService.getAllProgrammes(status, type, publicOnly));
    }

    /**
     * Private (and other) programmes the current user was invited to — the only
     * way a porteur discovers an invitation-only programme. Ids are resolved from
     * the caller's own token, so nothing here can be spoofed.
     */
    @GetMapping("/invited")
    public ResponseEntity<List<ProgrammeDto>> getInvited() {
        return ResponseEntity.ok(programmeService.getMyInvitedProgrammes());
    }

    /** Get a single programme with its criteria and phases — public. */
    @GetMapping("/{id}")
    public ResponseEntity<ProgrammeDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(programmeService.getProgrammeById(id));
    }

    /** Create a new programme — ADMIN only. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:create')")
    public ResponseEntity<ProgrammeDto> create(
            @Valid @RequestBody CreateProgrammeRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String adminName) {
        return ResponseEntity.status(201)
                .body(programmeService.createProgramme(req, adminId, adminName != null ? adminName : "Admin"));
    }

    /** Full update of a programme — ADMIN only. */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeDto> update(
            @PathVariable Long id,
            @RequestBody UpdateProgrammeRequest req) {
        return ResponseEntity.ok(programmeService.updateProgramme(id, req));
    }

    /** Delete a programme + all its phases / criteria / partner links — ADMIN only. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:delete')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        programmeService.deleteProgramme(id);
        return ResponseEntity.noContent().build();
    }

    /** Change programme status — ADMIN only. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeDto> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ProgrammeStatusRequest req) {
        return ResponseEntity.ok(programmeService.updateStatus(id, req.getStatus()));
    }

    /** Count programmes by status — ADMIN only. */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:read')")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(programmeService.getStats());
    }

    // ── Criteria ──────────────────────────────────────────────────────────────

    /** List all criteria of a programme — public. */
    @GetMapping("/{id}/criteria")
    public ResponseEntity<List<ProgrammeCriteriaDto>> getCriteria(@PathVariable Long id) {
        return ResponseEntity.ok(programmeService.getCriteria(id));
    }

    /** Add a criterion to a programme — ADMIN only. */
    @PostMapping("/{id}/criteria")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeCriteriaDto> addCriterion(
            @PathVariable Long id,
            @Valid @RequestBody CreateCriteriaRequest req) {
        return ResponseEntity.status(201).body(programmeService.addCriterion(id, req));
    }

    /** Update a criterion — ADMIN only. */
    @PutMapping("/{id}/criteria/{criterionId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeCriteriaDto> updateCriterion(
            @PathVariable Long id,
            @PathVariable Long criterionId,
            @RequestBody UpdateCriteriaRequest req) {
        return ResponseEntity.ok(programmeService.updateCriterion(id, criterionId, req));
    }

    /** Remove a criterion — ADMIN only. */
    @DeleteMapping("/{id}/criteria/{criterionId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> deleteCriterion(
            @PathVariable Long id,
            @PathVariable Long criterionId) {
        programmeService.deleteCriterion(id, criterionId);
        return ResponseEntity.noContent().build();
    }

    // ── Phases ────────────────────────────────────────────────────────────────

    /** List all phases of a programme — public. */
    @GetMapping("/{id}/phases")
    public ResponseEntity<List<ProgrammePhaseDto>> getPhases(@PathVariable Long id) {
        return ResponseEntity.ok(programmeService.getPhases(id));
    }

    /** Add a phase to a programme — ADMIN only. */
    @PostMapping("/{id}/phases")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammePhaseDto> addPhase(
            @PathVariable Long id,
            @Valid @RequestBody CreatePhaseRequest req) {
        return ResponseEntity.status(201).body(programmeService.addPhase(id, req));
    }

    /** Update a phase — ADMIN only. */
    @PutMapping("/{id}/phases/{phaseId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammePhaseDto> updatePhase(
            @PathVariable Long id,
            @PathVariable Long phaseId,
            @RequestBody UpdatePhaseRequest req) {
        return ResponseEntity.ok(programmeService.updatePhase(id, phaseId, req));
    }

    /** Delete a phase — ADMIN only. */
    @DeleteMapping("/{id}/phases/{phaseId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> deletePhase(
            @PathVariable Long id,
            @PathVariable Long phaseId) {
        programmeService.deletePhase(id, phaseId);
        return ResponseEntity.noContent().build();
    }
}
