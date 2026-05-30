package com.medianet.auth.controller;

import com.medianet.auth.dto.*;
import com.medianet.auth.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST surface for {@link com.medianet.auth.entity.Organization} and its members.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>GET    /api/organizations                         — list, ?type=&internal=&createdByUserId=</li>
 *   <li>POST   /api/organizations                         — create (auth required)</li>
 *   <li>GET    /api/organizations/{id}                    — details</li>
 *   <li>PUT    /api/organizations/{id}                    — update</li>
 *   <li>DELETE /api/organizations/{id}                    — delete</li>
 *   <li>GET    /api/organizations/{id}/members            — list members</li>
 *   <li>POST   /api/organizations/{id}/members            — add member</li>
 *   <li>PUT    /api/organizations/{id}/members/{memberId} — update member</li>
 *   <li>DELETE /api/organizations/{id}/members/{memberId} — remove member</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService service;

    @GetMapping
    public ResponseEntity<List<OrganizationDto>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Boolean internal,
            @RequestParam(required = false) Long createdByUserId) {
        return ResponseEntity.ok(service.list(type, internal, createdByUserId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<OrganizationDto> create(
            @Valid @RequestBody CreateOrganizationRequest req,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.status(201).body(service.create(req, userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrganizationDto> update(
            @PathVariable Long id,
            @RequestBody UpdateOrganizationRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Members ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/members")
    public ResponseEntity<List<OrganizationMemberDto>> listMembers(@PathVariable Long id) {
        return ResponseEntity.ok(service.listMembers(id));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<OrganizationMemberDto> addMember(
            @PathVariable Long id,
            @Valid @RequestBody CreateOrganizationMemberRequest req) {
        return ResponseEntity.status(201).body(service.addMember(id, req));
    }

    @PutMapping("/{id}/members/{memberId}")
    public ResponseEntity<OrganizationMemberDto> updateMember(
            @PathVariable Long id,
            @PathVariable Long memberId,
            @RequestBody UpdateOrganizationMemberRequest req) {
        return ResponseEntity.ok(service.updateMember(id, memberId, req));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable Long id,
            @PathVariable Long memberId) {
        service.removeMember(id, memberId);
        return ResponseEntity.noContent().build();
    }
}
