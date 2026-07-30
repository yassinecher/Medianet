package com.medianet.auth.controller;

import com.medianet.auth.dto.*;
import com.medianet.auth.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final com.medianet.auth.repository.OrganizationRepository organizationRepository;

    // ── PUBLIC « Sociétés incubées » showcase ────────────────────────────────
    /** Trimmed public profile of the organisations the admin chose to showcase.
     *  No members / owner data ever leaves this endpoint. */
    @GetMapping("/public")
    public ResponseEntity<List<java.util.Map<String, Object>>> publicShowcase() {
        return ResponseEntity.ok(organizationRepository.findAll().stream()
                .filter(o -> Boolean.TRUE.equals(o.getShowcased()))
                .map(o -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", o.getId());
                    m.put("name", o.getName());
                    m.put("logoUrl", o.getLogoUrl());
                    m.put("description", o.getDescription());
                    m.put("sector", o.getSector());
                    m.put("website", o.getWebsite());
                    m.put("city", o.getCity());
                    m.put("foundedYear", o.getFoundedYear());
                    return m;
                }).collect(java.util.stream.Collectors.toList()));
    }

    /** Admin: publish / hide an organisation on the public showcase page. */
    @PutMapping("/{id}/showcase")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('organizations:update')")
    public ResponseEntity<Void> setShowcased(@PathVariable Long id,
                                             @RequestBody java.util.Map<String, Boolean> body) {
        com.medianet.auth.entity.Organization o = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + id));
        o.setShowcased(Boolean.TRUE.equals(body.get("showcased")));
        organizationRepository.save(o);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<OrganizationDto>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Boolean internal,
            @RequestParam(required = false) Long createdByUserId,
            @RequestParam(required = false) Long memberUserId,
            @RequestParam(required = false) Long mentorUserId,
            @RequestParam(required = false) Long porteurUserId) {
        return ResponseEntity.ok(service.list(type, internal, createdByUserId, memberUserId, mentorUserId, porteurUserId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationDto> get(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.get(id, userId, isPrivileged()));
    }

    /** ADMIN and JURY are trusted reviewers (jury opens the org from an evaluation). */
    private boolean isPrivileged() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("ROLE_JURY"));
    }

    /** ADMIN only — used to gate write operations (coaching) that jury must not do. */
    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().map(a -> a.getAuthority()).anyMatch(a -> a.equals("ROLE_ADMIN"));
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
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('organizations:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Porteur / vis-à-vis (mentor) assignment (admin) ──────────────────────

    /** Assign the porteur representing the org. {@code userId} null → reset to creator. */
    @PutMapping("/{id}/porteur")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('organizations:update')")
    public ResponseEntity<OrganizationDto> assignPorteur(
            @PathVariable Long id, @RequestBody java.util.Map<String, Long> body) {
        return ResponseEntity.ok(service.assignPorteur(id, body.get("userId")));
    }

    /** Assign the « vis-à-vis » mentor/référent. {@code userId} null → clear it. */
    @PutMapping("/{id}/mentor")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('organizations:update')")
    public ResponseEntity<OrganizationDto> assignMentor(
            @PathVariable Long id, @RequestBody java.util.Map<String, Long> body) {
        return ResponseEntity.ok(service.assignMentor(id, body.get("userId")));
    }

    // ── Coaching (mentor accompaniment) ──────────────────────────────────────

    @GetMapping("/{id}/coaching")
    public ResponseEntity<CoachingDto> getCoaching(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.getCoaching(id, userId, isPrivileged(), isAdmin()));
    }

    @PutMapping("/{id}/coaching/plan")
    public ResponseEntity<CoachingPlanDto> upsertCoachingPlan(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody UpdateCoachingPlanRequest req) {
        return ResponseEntity.ok(service.upsertCoachingPlan(id, userId, isAdmin(), req));
    }

    @PostMapping("/{id}/coaching/notes")
    public ResponseEntity<CoachingNoteDto> addCoachingNote(
            @PathVariable Long id, @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody CoachingNoteRequest req) {
        return ResponseEntity.status(201).body(service.addCoachingNote(id, userId, isAdmin(), req));
    }

    @PutMapping("/{id}/coaching/notes/{noteId}")
    public ResponseEntity<CoachingNoteDto> updateCoachingNote(
            @PathVariable Long id, @PathVariable Long noteId,
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody CoachingNoteRequest req) {
        return ResponseEntity.ok(service.updateCoachingNote(id, noteId, userId, isAdmin(), req));
    }

    @DeleteMapping("/{id}/coaching/notes/{noteId}")
    public ResponseEntity<Void> deleteCoachingNote(
            @PathVariable Long id, @PathVariable Long noteId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        service.deleteCoachingNote(id, noteId, userId, isAdmin());
        return ResponseEntity.noContent().build();
    }

    // ── Members ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/members")
    public ResponseEntity<List<OrganizationMemberDto>> listMembers(
            @PathVariable Long id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(service.listMembers(id, userId, isPrivileged()));
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
