package com.medianet.programme.controller;

import com.medianet.programme.dto.SessionPresetDto;
import com.medianet.programme.dto.SessionPresetRequest;
import com.medianet.programme.service.SessionPresetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST surface for reusable session presets (Parcours library).
 * Reads are public (the GET allowlist in SecurityConfig); writes are ADMIN-only.
 */
@RestController
@RequestMapping("/api/session-presets")
@RequiredArgsConstructor
public class SessionPresetController {

    private final SessionPresetService service;

    /** Global presets + (optionally) the presets local to {@code programmeId}. */
    @GetMapping
    public ResponseEntity<List<SessionPresetDto>> list(
            @RequestParam(required = false) Long programmeId) {
        return ResponseEntity.ok(service.list(programmeId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<SessionPresetDto> create(@RequestBody SessionPresetRequest req) {
        return ResponseEntity.status(201).body(service.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<SessionPresetDto> update(
            @PathVariable Long id, @RequestBody SessionPresetRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
