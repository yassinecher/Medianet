package com.medianet.programme.controller;

import com.medianet.programme.dto.*;
import com.medianet.programme.service.ProgrammeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PartnerController {

    private final ProgrammeService programmeService;

    // ── Global partner library ────────────────────────────────────────────────

    @GetMapping("/api/partners")
    public ResponseEntity<List<PartnerDto>> getAllPartners() {
        return ResponseEntity.ok(programmeService.getAllPartners());
    }

    @PostMapping("/api/partners")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<PartnerDto> createPartner(@Valid @RequestBody CreatePartnerRequest req) {
        return ResponseEntity.status(201).body(programmeService.createPartner(req));
    }

    /** Update a partner's profile + public visibility (partial: null = keep). */
    @PutMapping("/api/partners/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<PartnerDto> updatePartner(@PathVariable Long id, @RequestBody CreatePartnerRequest req) {
        return ResponseEntity.ok(programmeService.updatePartner(id, req));
    }

    // ── PUBLIC site (no auth — only partners the admin made visible) ─────────

    @GetMapping("/api/partners/public")
    public ResponseEntity<List<PartnerDto>> getPublicPartners() {
        return ResponseEntity.ok(programmeService.getPublicPartners());
    }

    @GetMapping("/api/partners/public/{id}")
    public ResponseEntity<PartnerDto> getPublicPartner(@PathVariable Long id) {
        return ResponseEntity.ok(programmeService.getPublicPartner(id));
    }

    @DeleteMapping("/api/partners/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> deletePartner(@PathVariable Long id) {
        programmeService.deletePartner(id);
        return ResponseEntity.noContent().build();
    }

    // ── Programme ↔ partner association ──────────────────────────────────────

    @GetMapping("/api/programmes/{programmeId}/partners")
    public ResponseEntity<List<PartnerDto>> getProgrammePartners(@PathVariable Long programmeId) {
        return ResponseEntity.ok(programmeService.getProgrammePartners(programmeId));
    }

    @PostMapping("/api/programmes/{programmeId}/partners/{partnerId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeDto> addPartner(
            @PathVariable Long programmeId,
            @PathVariable Long partnerId) {
        return ResponseEntity.ok(programmeService.addPartnerToProgramme(programmeId, partnerId));
    }

    @DeleteMapping("/api/programmes/{programmeId}/partners/{partnerId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<ProgrammeDto> removePartner(
            @PathVariable Long programmeId,
            @PathVariable Long partnerId) {
        return ResponseEntity.ok(programmeService.removePartnerFromProgramme(programmeId, partnerId));
    }
}
