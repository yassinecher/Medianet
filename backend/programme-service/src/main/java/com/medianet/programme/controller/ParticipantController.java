package com.medianet.programme.controller;

import com.medianet.programme.dto.ProgrammeParticipantDto;
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
 * Programme participation roster (organisation × programme) + per-programme
 * mentor assignment. Everything here is programme-scoped — the participation is
 * the parent of the mentor and the coaching.
 */
@RestController
@RequestMapping("/api/participants")
@RequiredArgsConstructor
public class ParticipantController {

    private final ParticipantService service;

    /** Roster of a programme (admin / reviewer). Syncs from accepted candidatures. */
    @GetMapping
    public ResponseEntity<List<ProgrammeParticipantDto>> list(@RequestParam Long programmeId) {
        return ResponseEntity.ok(service.listForProgramme(programmeId));
    }

    /** The startups the calling mentor accompanies, across all programmes. */
    @GetMapping("/mine")
    public ResponseEntity<List<ProgrammeParticipantDto>> mine(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.myMentees(userId));
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

    // Admin gate — matches the manual-authority-check style used elsewhere in
    // this service (e.g. PitchController), since method security isn't enabled.
    private void requireAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = auth != null && auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("programmes:update"));
        if (!admin) throw new AccessDeniedException("Réservé à l'administrateur.");
    }
}
