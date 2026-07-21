package com.medianet.programme.controller;

import com.medianet.programme.dto.PitchSubmissionDto;
import com.medianet.programme.dto.PitchSubmissionRequest;
import com.medianet.programme.entity.PitchStatus;
import com.medianet.programme.service.PitchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Pitch submissions for presentation days.
 *
 * <p>Porteurs manage their own submission (upload video URL + transcript, run
 * AI analysis via admin-ai, then save the result here). Admins list every
 * submission of a programme/session to review scores and advice.
 */
@RestController
@RequestMapping("/api/pitch")
@RequiredArgsConstructor
public class PitchController {

    private final PitchService pitchService;

    // ── Porteur (owner) ──────────────────────────────────────────────────────

    /** Create or update the caller's own submission. */
    @PostMapping("/submissions")
    public ResponseEntity<PitchSubmissionDto> upsert(
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName,
            @RequestBody PitchSubmissionRequest req) {
        return ResponseEntity.ok(pitchService.upsertOwn(userId, firstName, req));
    }

    /** The caller's own submissions. */
    @GetMapping("/submissions/mine")
    public ResponseEntity<List<PitchSubmissionDto>> mine(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(pitchService.getMine(userId));
    }

    /** A single submission — owner or admin. */
    @GetMapping("/submissions/{id}")
    public ResponseEntity<PitchSubmissionDto> get(
            @PathVariable Long id, @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(pitchService.getOne(id, userId, isAdminOrReviewer()));
    }

    /** Persist the AI analysis result (+ auto-transcript / duration) — owner or admin. */
    @PutMapping("/submissions/{id}/analysis")
    public ResponseEntity<PitchSubmissionDto> saveAnalysis(
            @PathVariable Long id, @RequestAttribute("userId") Long userId,
            @RequestBody Map<String, Object> body) {
        Double  score = body.get("aiScore") == null ? null : Double.valueOf(String.valueOf(body.get("aiScore")));
        String  json  = body.get("aiAnalysisJson") == null ? null : String.valueOf(body.get("aiAnalysisJson"));
        String  transcript = body.get("transcript") == null ? null : String.valueOf(body.get("transcript"));
        Boolean auto  = body.get("autoTranscribed") == null ? null : Boolean.valueOf(String.valueOf(body.get("autoTranscribed")));
        Integer dur   = body.get("durationSeconds") == null ? null : (int) Double.parseDouble(String.valueOf(body.get("durationSeconds")));
        String  segs  = body.get("segmentsJson") == null ? null : String.valueOf(body.get("segmentsJson"));
        return ResponseEntity.ok(pitchService.saveAnalysis(id, userId, isAdminOrReviewer(), score, json, transcript, auto, dur, segs));
    }

    /** Move a submission to PROCESSING / FAILED (owner or admin) — pipeline states. */
    @PutMapping("/submissions/{id}/status")
    public ResponseEntity<PitchSubmissionDto> setStatus(
            @PathVariable Long id, @RequestAttribute("userId") Long userId,
            @RequestBody Map<String, Object> body) {
        PitchStatus status = PitchStatus.valueOf(String.valueOf(body.get("status")).toUpperCase());
        return ResponseEntity.ok(pitchService.setStatus(id, userId, isAdminOrReviewer(), status));
    }

    /** Presentation sessions of a programme + the caller's submission per session. */
    @GetMapping("/presentations/{programmeId}")
    public ResponseEntity<List<Map<String, Object>>> presentations(
            @PathVariable Long programmeId, @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(pitchService.presentationsForProgramme(programmeId, userId));
    }

    /** Archive / unarchive a submission (owner or admin). Body: {archived: bool}. */
    @PatchMapping("/submissions/{id}/archive")
    public ResponseEntity<PitchSubmissionDto> archive(
            @PathVariable Long id, @RequestAttribute("userId") Long userId,
            @RequestBody Map<String, Object> body) {
        boolean archived = body.get("archived") == null || Boolean.parseBoolean(String.valueOf(body.get("archived")));
        return ResponseEntity.ok(pitchService.setArchived(id, userId, isAdminOrReviewer(), archived));
    }

    /** Soft-delete a submission (owner or admin) — moves it to the trash. */
    @DeleteMapping("/submissions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("userId") Long userId) {
        pitchService.softDelete(id, userId, isAdminOrReviewer());
        return ResponseEntity.noContent().build();
    }

    // ── Admin / reviewer ─────────────────────────────────────────────────────

    /** All submissions for a programme (or session) — reviewers only. */
    @GetMapping("/submissions")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:read') or hasAuthority('reports:read')")
    public ResponseEntity<List<PitchSubmissionDto>> list(
            @RequestParam(required = false) Long programmeId,
            @RequestParam(required = false) Long sessionId) {
        return ResponseEntity.ok(pitchService.list(programmeId, sessionId));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** True when the caller may review others' submissions (admin/programmes/reports). */
    private boolean isAdminOrReviewer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().map(Object::toString).anyMatch(a ->
                a.equals("ROLE_ADMIN") || a.equals("programmes:read") || a.equals("reports:read"));
    }
}
