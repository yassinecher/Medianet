package com.medianet.programme.controller;

import com.medianet.programme.dto.*;
import com.medianet.programme.service.ParticipantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Programme participation roster (organisation × programme), the per-programme
 * mentor assignment, and the coaching scoped to that participation. Everything
 * is programme-scoped — the participation is the parent of the mentor and the
 * coaching (which is why it lives here, not on the organisation).
 */
@RestController
@RequestMapping("/api/participants")
@RequiredArgsConstructor
public class ParticipantController {

    private final ParticipantService service;

    /** Roster of a programme (?programmeId) or the participations of an org (?organizationId). */
    @GetMapping
    public ResponseEntity<List<ProgrammeParticipantDto>> list(
            @RequestParam(required = false) Long programmeId,
            @RequestParam(required = false) Long organizationId) {
        if (organizationId != null) return ResponseEntity.ok(service.listForOrganization(organizationId));
        if (programmeId != null)    return ResponseEntity.ok(service.listForProgramme(programmeId));
        return ResponseEntity.ok(List.of());
    }

    /** The startups the calling mentor accompanies, across all programmes. */
    @GetMapping("/mine")
    public ResponseEntity<List<ProgrammeParticipantDto>> mine(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.myMentees(userId));
    }

    /** All my coaching engagements (as mentor or as porteur) — for the coaching module. */
    @GetMapping("/engagements")
    public ResponseEntity<List<ProgrammeParticipantDto>> engagements(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.myEngagements(userId));
    }

    /** One participation (for the coaching workspace header). */
    @GetMapping("/{id}")
    public ResponseEntity<ProgrammeParticipantDto> getOne(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.getOne(id, userId, isAdmin()));
    }

    @PutMapping("/{id}/mentor")
    public ResponseEntity<ProgrammeParticipantDto> assignMentor(
            @PathVariable Long id, @RequestBody Map<String, Long> body) {
        requireAdmin();
        return ResponseEntity.ok(service.assignMentor(id, body.get("mentorUserId")));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ProgrammeParticipantDto> setStatus(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        requireAdmin();
        return ResponseEntity.ok(service.setStatus(id, body.get("status")));
    }

    // ── Coaching (scoped to the participation) ───────────────────────────────

    @GetMapping("/{id}/coaching")
    public ResponseEntity<CoachingDto> getCoaching(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.getCoaching(id, userId, isAdmin()));
    }

    @PutMapping("/{id}/coaching/plan")
    public ResponseEntity<CoachingPlanDto> upsertPlan(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody UpdateCoachingPlanRequest req) {
        return ResponseEntity.ok(service.upsertCoachingPlan(id, userId, isAdmin(), req));
    }

    @PostMapping("/{id}/coaching/notes")
    public ResponseEntity<CoachingNoteDto> addNote(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName,
            @RequestAttribute(value = "userLastName", required = false) String lastName,
            @RequestBody CoachingNoteRequest req) {
        String author = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return ResponseEntity.status(201)
                .body(service.addCoachingNote(id, userId, author.isBlank() ? null : author, isAdmin(), req));
    }

    @PutMapping("/{id}/coaching/notes/{noteId}")
    public ResponseEntity<CoachingNoteDto> updateNote(
            @PathVariable Long id, @PathVariable Long noteId,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody CoachingNoteRequest req) {
        return ResponseEntity.ok(service.updateCoachingNote(id, noteId, userId, isAdmin(), req));
    }

    @DeleteMapping("/{id}/coaching/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(
            @PathVariable Long id, @PathVariable Long noteId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        service.deleteCoachingNote(id, noteId, userId, isAdmin());
        return ResponseEntity.noContent().build();
    }

    // ── Meetings (mentor ↔ porteur) ──────────────────────────────────────────

    @GetMapping("/{id}/meetings")
    public ResponseEntity<List<CoachingMeetingDto>> listMeetings(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.listMeetings(id, userId, isAdmin()));
    }

    @PostMapping("/{id}/meetings")
    public ResponseEntity<CoachingMeetingDto> createMeeting(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName,
            @RequestAttribute(value = "userLastName", required = false) String lastName,
            @RequestBody CoachingMeetingRequest req) {
        String who = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return ResponseEntity.status(201).body(service.createMeeting(id, userId, who.isBlank() ? null : who, isAdmin(), req));
    }

    @PutMapping("/meetings/{meetingId}/respond")
    public ResponseEntity<CoachingMeetingDto> respondMeeting(
            @PathVariable Long meetingId,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(service.respondMeeting(meetingId, userId, isAdmin(), body.get("status")));
    }

    /** All meetings across the caller's participations — for the shared calendar. */
    @GetMapping("/meetings/mine")
    public ResponseEntity<List<CoachingMeetingDto>> myMeetings(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.myMeetings(userId));
    }

    // ── Reviews (mentor / porteur / member feedback) ─────────────────────────

    @GetMapping("/{id}/reviews")
    public ResponseEntity<List<CoachingReviewDto>> listReviews(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.listReviews(id, userId, isAdmin()));
    }

    @PostMapping("/{id}/reviews")
    public ResponseEntity<CoachingReviewDto> addReview(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName,
            @RequestAttribute(value = "userLastName", required = false) String lastName,
            @RequestBody CoachingReviewRequest req) {
        String who = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return ResponseEntity.status(201).body(service.addReview(id, userId, who.isBlank() ? null : who, isAdmin(), req));
    }

    // ── Auth helpers (manual, matching this service's style) ─────────────────

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("programmes:update"));
    }

    private void requireAdmin() {
        if (!isAdmin()) throw new AccessDeniedException("Réservé à l'administrateur.");
    }
}
