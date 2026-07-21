package com.medianet.notification.service;

import com.medianet.notification.dto.*;
import com.medianet.notification.entity.*;
import com.medianet.notification.repository.InvitationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NotificationService {

    private final InvitationRepository invitationRepository;
    private final EmailService          emailService;

    // ── Single invitation ─────────────────────────────────────────────────────

    public InvitationDto createAndSend(CreateInvitationRequest req,
                                       Long adminId, String adminName) {
        Invitation inv = Invitation.builder()
                .type(parseType(req.getType()))
                .programmeId(req.getProgrammeId())
                .programmeName(req.getProgrammeName())
                .phaseId(req.getPhaseId())
                .phaseName(req.getPhaseName())
                .activityId(req.getActivityId())
                .activityName(req.getActivityName())
                .recipientEmail(req.getRecipientEmail().toLowerCase())
                .recipientName(req.getRecipientName())
                .subject(req.getSubject())
                .message(req.getMessage())
                .requiresRsvp(Boolean.TRUE.equals(req.getRequiresRsvp()))
                .sentByAdminId(adminId)
                .sentByAdminName(adminName)
                .build();

        inv = invitationRepository.save(inv);
        inv = dispatchEmail(inv);
        return toDto(invitationRepository.save(inv));
    }

    // ── Bulk invitation ───────────────────────────────────────────────────────

    public List<InvitationDto> bulkInvite(BulkInviteRequest req, Long adminId, String adminName) {
        List<InvitationDto> results = new ArrayList<>();
        for (BulkInviteRequest.RecipientItem r : req.getRecipients()) {
            Invitation inv = Invitation.builder()
                    .type(parseType(req.getType()))
                    .programmeId(req.getProgrammeId())
                    .programmeName(req.getProgrammeName())
                    .phaseId(req.getPhaseId())
                    .phaseName(req.getPhaseName())
                    .activityId(req.getActivityId())
                    .activityName(req.getActivityName())
                    .recipientEmail(r.getEmail().toLowerCase())
                    .recipientName(r.getName())
                    .subject(req.getSubject())
                    .message(req.getMessage())
                    .requiresRsvp(Boolean.TRUE.equals(req.getRequiresRsvp()))
                    .sentByAdminId(adminId)
                    .sentByAdminName(adminName)
                    .build();

            inv = invitationRepository.save(inv);
            inv = dispatchEmail(inv);
            results.add(toDto(invitationRepository.save(inv)));
        }
        return results;
    }

    // ── Generic email send ────────────────────────────────────────────────────

    public void sendEmail(SendEmailRequest req) {
        boolean isHtml = Boolean.TRUE.equals(req.getHtml());
        if (req.getToEmails() != null && !req.getToEmails().isEmpty()) {
            emailService.sendBroadcast(req.getToEmails(), req.getSubject(), req.getBody(), isHtml);
        } else if (req.getToEmail() != null) {
            emailService.sendRaw(req.getToEmail(), req.getToName(), req.getSubject(), req.getBody(), isHtml);
        } else {
            throw new IllegalArgumentException("Either toEmail or toEmails must be provided");
        }
    }

    // ── Session notification (per-type email + archived) ──────────────────────

    /**
     * Sends a session announcement, one tailored email per recipient type, and
     * records every recipient as an Invitation row (SENT / FAILED) so the send
     * is fully archived and queryable per programme / per session.
     */
    public List<InvitationDto> sessionNotify(SessionNotifyRequest req, Long adminId, String adminName) {
        List<InvitationDto> out = new ArrayList<>();
        if (req.getItems() == null) return out;
        for (SessionNotifyRequest.Item item : req.getItems()) {
            if (item.getRecipients() == null || item.getBody() == null) continue;
            InvitationType type = mapNotifyType(item.getType());
            for (SessionNotifyRequest.Recipient r : item.getRecipients()) {
                if (r.getEmail() == null || r.getEmail().isBlank()) continue;
                Invitation inv = Invitation.builder()
                        .type(type)
                        .programmeId(req.getProgrammeId())
                        .programmeName(req.getProgrammeName())
                        .phaseId(req.getPhaseId())
                        .phaseName(req.getPhaseName())
                        .recipientEmail(r.getEmail().toLowerCase())
                        .recipientName(r.getName())
                        .subject(item.getSubject())
                        .message(item.getBody())
                        .requiresRsvp(false)
                        .sentByAdminId(adminId)
                        .sentByAdminName(adminName)
                        .build();
                inv = invitationRepository.save(inv);
                try {
                    emailService.sendRaw(inv.getRecipientEmail(), inv.getRecipientName(),
                            inv.getSubject(), item.getBody(), true);
                    inv.setStatus(InvitationStatus.SENT);
                    inv.setSentAt(LocalDateTime.now());
                } catch (Exception e) {
                    log.error("Session-notify email failed for {}: {}", inv.getRecipientEmail(), e.getMessage());
                    inv.setStatus(InvitationStatus.FAILED);
                    inv.setErrorMessage(e.getMessage());
                }
                out.add(toDto(invitationRepository.save(inv)));
            }
        }
        return out;
    }

    private InvitationType mapNotifyType(String t) {
        if (t == null) return InvitationType.GENERAL;
        switch (t.toLowerCase()) {
            case "jury":          return InvitationType.JURY;
            case "porteur":       return InvitationType.PORTEUR;
            case "member": case "membre": return InvitationType.MEMBER;
            case "organisateur": case "responsable": return InvitationType.ORGANISATEUR;
            case "invite": case "guest": return InvitationType.GUEST;
            default:              return InvitationType.GENERAL;
        }
    }

    // ── RSVP (public — no auth, just the token) ───────────────────────────────

    @Transactional
    public InvitationDto acceptInvitation(String token) {
        Invitation inv = findByToken(token);
        inv.setStatus(InvitationStatus.ACCEPTED);
        return toDto(invitationRepository.save(inv));
    }

    @Transactional
    public InvitationDto declineInvitation(String token) {
        Invitation inv = findByToken(token);
        inv.setStatus(InvitationStatus.DECLINED);
        return toDto(invitationRepository.save(inv));
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<InvitationDto> getAll() {
        return invitationRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InvitationDto getById(Long id) {
        return toDto(invitationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found: " + id)));
    }

    @Transactional(readOnly = true)
    public InvitationDto getByToken(String token) {
        return toDto(findByToken(token));
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getByProgramme(Long programmeId, String type, String status) {
        if (type != null) {
            return invitationRepository
                    .findByProgrammeIdAndTypeOrderByCreatedAtDesc(programmeId, parseType(type))
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        if (status != null) {
            return invitationRepository
                    .findByProgrammeIdAndStatusOrderByCreatedAtDesc(programmeId, parseStatus(status))
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        return invitationRepository.findByProgrammeIdOrderByCreatedAtDesc(programmeId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    /** Session (phase) ids the given email was explicitly invited to. */
    @Transactional(readOnly = true)
    public List<Long> getInvitedPhaseIds(String email) {
        if (email == null || email.isBlank()) return List.of();
        return invitationRepository.findInvitedPhaseIds(email);
    }

    /** Programme ids the caller has been invited to — used to reveal private
     *  programmes only to their invitees. */
    @Transactional(readOnly = true)
    public List<Long> getInvitedProgrammeIds(String email) {
        if (email == null || email.isBlank()) return List.of();
        return invitationRepository.findInvitedProgrammeIds(email);
    }

    /** Full invitations addressed to the given recipient — newest first.
     *  Feeds the front-office notifications feed (bell + /notifications page). */
    @Transactional(readOnly = true)
    public List<InvitationDto> getMyInvitations(String email) {
        if (email == null || email.isBlank()) return List.of();
        return invitationRepository.findByRecipientEmailOrderByCreatedAtDesc(email.toLowerCase())
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getByPhase(Long phaseId) {
        return invitationRepository.findByPhaseIdOrderByCreatedAtDesc(phaseId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getByActivity(Long activityId) {
        return invitationRepository.findByActivityIdOrderByCreatedAtDesc(activityId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getGlobalStats() {
        Map<String, Long> out = new java.util.LinkedHashMap<>();
        long total = invitationRepository.count();
        out.put("total", total);
        for (InvitationStatus s : InvitationStatus.values()) {
            out.put(s.name().toLowerCase(), invitationRepository.countByStatus(s));
        }
        for (InvitationType t : InvitationType.values()) {
            out.put("type_" + t.name().toLowerCase(), invitationRepository.countByType(t));
        }
        return out;
    }

    public InvitationDto resend(Long id) {
        Invitation inv = invitationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found: " + id));
        if (inv.getStatus() == InvitationStatus.ACCEPTED || inv.getStatus() == InvitationStatus.DECLINED) {
            throw new IllegalStateException("Cette invitation a déjà reçu une réponse — vous ne pouvez plus la renvoyer.");
        }
        inv.setStatus(InvitationStatus.PENDING);
        inv.setErrorMessage(null);
        inv = dispatchEmail(inv);
        return toDto(invitationRepository.save(inv));
    }

    public void delete(Long id) {
        Invitation inv = invitationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found: " + id));
        invitationRepository.delete(inv);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStats(Long programmeId) {
        return Map.of(
                "total",    invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.SENT)
                          + invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.PENDING)
                          + invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.FAILED)
                          + invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.ACCEPTED)
                          + invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.DECLINED),
                "sent",     invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.SENT),
                "accepted", invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.ACCEPTED),
                "declined", invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.DECLINED),
                "failed",   invitationRepository.countByProgrammeIdAndStatus(programmeId, InvitationStatus.FAILED),
                "jury",     invitationRepository.countByProgrammeIdAndType(programmeId, InvitationType.JURY),
                "porteur",  invitationRepository.countByProgrammeIdAndType(programmeId, InvitationType.PORTEUR)
        );
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private Invitation dispatchEmail(Invitation inv) {
        try {
            // Account-creation invites for JURY / MENTOR / PORTEUR (admin invite path)
            // override the RSVP flag and use a dedicated "create my account" email.
            boolean isAccountInvite = inv.getType() == InvitationType.JURY
                                   || inv.getType() == InvitationType.MENTOR
                                   || inv.getType() == InvitationType.PORTEUR;
            if (isAccountInvite) {
                emailService.sendAccountInvitationEmail(inv);
            } else if (Boolean.TRUE.equals(inv.getRequiresRsvp())) {
                emailService.sendRsvpEmail(inv);
            } else {
                emailService.sendInvitationEmail(inv);
            }
            inv.setStatus(InvitationStatus.SENT);
            inv.setSentAt(LocalDateTime.now());
        } catch (Exception e) {
            log.error("Email failed for {}: {}", inv.getRecipientEmail(), e.getMessage());
            inv.setStatus(InvitationStatus.FAILED);
            inv.setErrorMessage(e.getMessage());
        }
        return inv;
    }

    private Invitation findByToken(String token) {
        return invitationRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid invitation token"));
    }

    private InvitationDto toDto(Invitation inv) {
        return InvitationDto.builder()
                .id(inv.getId())
                .token(inv.getToken())
                .type(inv.getType().name())
                .status(inv.getStatus().name())
                .programmeId(inv.getProgrammeId())
                .programmeName(inv.getProgrammeName())
                .phaseId(inv.getPhaseId())
                .phaseName(inv.getPhaseName())
                .activityId(inv.getActivityId())
                .activityName(inv.getActivityName())
                .recipientEmail(inv.getRecipientEmail())
                .recipientName(inv.getRecipientName())
                .subject(inv.getSubject())
                .message(inv.getMessage())
                .requiresRsvp(inv.getRequiresRsvp())
                .sentByAdminId(inv.getSentByAdminId())
                .sentByAdminName(inv.getSentByAdminName())
                .sentAt(inv.getSentAt())
                .errorMessage(inv.getErrorMessage())
                .createdAt(inv.getCreatedAt())
                .updatedAt(inv.getUpdatedAt())
                .build();
    }

    private InvitationType parseType(String t) {
        try { return InvitationType.valueOf(t.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid invitation type: " + t); }
    }

    private InvitationStatus parseStatus(String s) {
        try { return InvitationStatus.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid invitation status: " + s); }
    }
}
