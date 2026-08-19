package com.medianet.programme.controller;

import com.medianet.programme.dto.WorkshopDto;
import com.medianet.programme.dto.WorkshopRequest;
import com.medianet.programme.service.WorkshopService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Workshops / ateliers for specific incubated startups within a programme.
 * Admin manages them; the calling porteur/mentor reads the ones that concern
 * them (via /mine) for the shared calendar.
 */
@RestController
@RequestMapping("/api/workshops")
@RequiredArgsConstructor
public class WorkshopController {

    private final WorkshopService service;

    /** All workshops of a programme (?programmeId). */
    @GetMapping
    public ResponseEntity<List<WorkshopDto>> list(@RequestParam Long programmeId) {
        return ResponseEntity.ok(service.listForProgramme(programmeId));
    }

    /** Workshops concerning the caller (mentor or porteur of a target startup). */
    @GetMapping("/mine")
    public ResponseEntity<List<WorkshopDto>> mine(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(service.myWorkshops(userId));
    }

    @PostMapping
    public ResponseEntity<WorkshopDto> create(
            @RequestParam Long programmeId,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody WorkshopRequest req) {
        requireAdmin();
        return ResponseEntity.status(201).body(service.create(programmeId, userId, req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WorkshopDto> update(@PathVariable Long id, @RequestBody WorkshopRequest req) {
        requireAdmin();
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        requireAdmin();
        service.delete(id);
        return ResponseEntity.noContent().build();
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
