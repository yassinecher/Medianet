package com.medianet.candidature.controller;

import com.medianet.candidature.dto.CandidatureSelectionDto;
import com.medianet.candidature.dto.SelectionRequest;
import com.medianet.candidature.service.CandidatureSelectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Saved candidature-list versions (shortlists) for the Présélection session. */
@RestController
@RequestMapping("/api/candidatures")
@RequiredArgsConstructor
public class CandidatureSelectionController {

    private final CandidatureSelectionService service;

    @GetMapping("/programme/{programmeId}/selections")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update') or hasAuthority('candidatures:read')")
    public ResponseEntity<List<CandidatureSelectionDto>> list(@PathVariable Long programmeId) {
        return ResponseEntity.ok(service.list(programmeId));
    }

    @PostMapping("/programme/{programmeId}/selections")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureSelectionDto> create(
            @PathVariable Long programmeId, @Valid @RequestBody SelectionRequest req) {
        return ResponseEntity.status(201).body(service.create(programmeId, req));
    }

    @PutMapping("/selections/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<CandidatureSelectionDto> update(
            @PathVariable Long id, @RequestBody SelectionRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/selections/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('candidatures:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
