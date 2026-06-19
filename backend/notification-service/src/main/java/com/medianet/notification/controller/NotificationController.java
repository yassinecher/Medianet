package com.medianet.notification.controller;

import com.medianet.notification.dto.*;
import com.medianet.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // ── Single invitation ─────────────────────────────────────────────────────

    /**
     * Create and immediately send one invitation email — ADMIN only.
     */
    @PostMapping("/invitations")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<InvitationDto> invite(
            @Valid @RequestBody CreateInvitationRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String adminName) {
        return ResponseEntity.status(201)
                .body(notificationService.createAndSend(req, adminId,
                        adminName != null ? adminName : "Admin"));
    }

    // ── Bulk invitation ───────────────────────────────────────────────────────

    /**
     * Send the same invitation to a list of recipients — ADMIN only.
     */
    @PostMapping("/invitations/bulk")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<List<InvitationDto>> bulkInvite(
            @Valid @RequestBody BulkInviteRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String adminName) {
        return ResponseEntity.status(201)
                .body(notificationService.bulkInvite(req, adminId,
                        adminName != null ? adminName : "Admin"));
    }

    // ── Generic email send ────────────────────────────────────────────────────

    /**
     * Send a freeform email — ADMIN only.
     */
    @PostMapping("/email/send")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<Void> sendEmail(@Valid @RequestBody SendEmailRequest req) {
        notificationService.sendEmail(req);
        return ResponseEntity.ok().build();
    }

    /**
     * Notify a session's participants — one tailored email per recipient type —
     * and archive every send (returns the created invitation rows).
     */
    @PostMapping("/email/session-notify")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<List<InvitationDto>> sessionNotify(
            @RequestBody SessionNotifyRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String adminName) {
        return ResponseEntity.ok(
                notificationService.sessionNotify(req, adminId, adminName != null ? adminName : "Admin"));
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @GetMapping("/invitations")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<InvitationDto>> getAll() {
        return ResponseEntity.ok(notificationService.getAll());
    }

    @GetMapping("/invitations/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<InvitationDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.getById(id));
    }

    @GetMapping("/invitations/programme/{programmeId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<InvitationDto>> getByProgramme(
            @PathVariable Long programmeId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(notificationService.getByProgramme(programmeId, type, status));
    }

    @GetMapping("/invitations/phase/{phaseId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<InvitationDto>> getByPhase(@PathVariable Long phaseId) {
        return ResponseEntity.ok(notificationService.getByPhase(phaseId));
    }

    @GetMapping("/invitations/activity/{activityId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<InvitationDto>> getByActivity(@PathVariable Long activityId) {
        return ResponseEntity.ok(notificationService.getByActivity(activityId));
    }

    @GetMapping("/invitations/programme/{programmeId}/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<Map<String, Long>> getStats(@PathVariable Long programmeId) {
        return ResponseEntity.ok(notificationService.getStats(programmeId));
    }

    /** Global stats across all invitations — ADMIN. */
    @GetMapping("/invitations/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<Map<String, Long>> getGlobalStats() {
        return ResponseEntity.ok(notificationService.getGlobalStats());
    }

    // ── Resend / cancel ───────────────────────────────────────────────────────

    /**
     * Resend an existing invitation email. Useful for FAILED rows or when
     * the recipient says they can't find the original message.
     */
    @PostMapping("/invitations/{id}/resend")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<InvitationDto> resend(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.resend(id));
    }

    /**
     * Delete an invitation row (cancels it). The token is invalidated immediately.
     */
    @DeleteMapping("/invitations/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        notificationService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── RSVP — PUBLIC (no auth — recipients click from email) ─────────────────

    /**
     * Recipient clicks "Accept" from the email link.
     * Returns the invitation so a frontend page can display a confirmation.
     */
    @PatchMapping("/invitations/{token}/accept")
    public ResponseEntity<InvitationDto> accept(@PathVariable String token) {
        return ResponseEntity.ok(notificationService.acceptInvitation(token));
    }

    /**
     * Recipient clicks "Decline" from the email link.
     */
    @PatchMapping("/invitations/{token}/decline")
    public ResponseEntity<InvitationDto> decline(@PathVariable String token) {
        return ResponseEntity.ok(notificationService.declineInvitation(token));
    }

    /**
     * Public token lookup — lets the frontend show invitation details on the RSVP page.
     */
    @GetMapping("/invitations/token/{token}")
    public ResponseEntity<InvitationDto> getByToken(@PathVariable String token) {
        return ResponseEntity.ok(notificationService.getByToken(token));
    }
}
