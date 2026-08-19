package com.medianet.programme.controller;

import com.medianet.programme.dto.AvailabilityDto;
import com.medianet.programme.dto.AvailabilityRequest;
import com.medianet.programme.service.AvailabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Mentor availability slots. A mentor manages their own slots (/mine); the
 * porteur (or mentor) of a participation views the participation mentor's open
 * slots and books one — which creates an accepted coaching meeting.
 */
@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
public class AvailabilityController {

    private final AvailabilityService service;

    /** The caller's own availability slots (as a mentor). */
    @GetMapping("/mine")
    public ResponseEntity<List<AvailabilityDto>> mine(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.listMine(userId));
    }

    /** Publish a slot for the caller. */
    @PostMapping("/mine")
    public ResponseEntity<AvailabilityDto> create(
            @RequestAttribute("userId") Long userId, @RequestBody AvailabilityRequest req) {
        return ResponseEntity.status(201).body(service.create(userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("userId") Long userId) {
        service.delete(id, userId, isAdmin());
        return ResponseEntity.noContent().build();
    }

    /** Open future slots of a participation's mentor (for the porteur to book). */
    @GetMapping("/participant/{participantId}")
    public ResponseEntity<List<AvailabilityDto>> forParticipant(
            @PathVariable Long participantId, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.listForParticipation(participantId, userId, isAdmin()));
    }

    /** Book an open slot for a participation → creates an accepted meeting. */
    @PostMapping("/{id}/book")
    public ResponseEntity<AvailabilityDto> book(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName,
            @RequestAttribute(value = "userLastName", required = false) String lastName,
            @RequestBody Map<String, Long> body) {
        String who = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return ResponseEntity.ok(service.book(id, userId, who.isBlank() ? null : who, isAdmin(), body.get("participantId")));
    }

    // ── Auth helper ──────────────────────────────────────────────────────────

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("programmes:update"));
    }
}
