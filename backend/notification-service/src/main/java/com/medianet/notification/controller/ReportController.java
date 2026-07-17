package com.medianet.notification.controller;

import com.medianet.notification.entity.Invitation;
import com.medianet.notification.entity.InvitationStatus;
import com.medianet.notification.entity.InvitationType;
import com.medianet.notification.repository.ContactRepository;
import com.medianet.notification.repository.InvitationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregated invitation/email statistics for the back-office Reports module.
 * Gated by the ADMIN-scoped {@code reports:read} permission.
 */
@RestController
@RequestMapping("/api/notifications/reports")
@RequiredArgsConstructor
public class ReportController {

    private final InvitationRepository invitationRepository;
    private final ContactRepository    contactRepository;

    /** Programme-scoped invitation report (drives the programme's Rapports tab). */
    @GetMapping("/programme/{programmeId}")
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> programmeReport(@PathVariable Long programmeId) {
        List<Invitation> all = invitationRepository.findAll().stream()
                .filter(i -> programmeId.equals(i.getProgrammeId())).toList();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (InvitationStatus s : InvitationStatus.values()) byStatus.put(s.name(), 0L);
        for (Invitation i : all) {
            if (i.getStatus() != null) byStatus.merge(i.getStatus().name(), 1L, Long::sum);
        }
        Map<String, Long> byType = new LinkedHashMap<>();
        for (InvitationType t : InvitationType.values()) byType.put(t.name(), 0L);
        for (Invitation i : all) {
            if (i.getType() != null) byType.merge(i.getType().name(), 1L, Long::sum);
        }

        long accepted  = byStatus.getOrDefault("ACCEPTED", 0L);
        long declined  = byStatus.getOrDefault("DECLINED", 0L);
        long delivered = byStatus.getOrDefault("SENT", 0L) + accepted + declined;
        long answered  = accepted + declined;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("programmeId", programmeId);
        out.put("total", all.size());
        out.put("byStatus", byStatus);
        out.put("byType", byType);
        out.put("delivered", delivered);
        out.put("answered", answered);
        out.put("accepted", accepted);
        out.put("acceptanceRate", answered == 0 ? null : Math.round(accepted * 1000.0 / answered) / 10.0);
        out.put("failed", byStatus.getOrDefault("FAILED", 0L));
        return ResponseEntity.ok(out);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> invitationsReport() {
        List<Invitation> all = invitationRepository.findAll();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (InvitationStatus s : InvitationStatus.values()) byStatus.put(s.name(), 0L);
        for (Invitation i : all) {
            if (i.getStatus() != null) byStatus.merge(i.getStatus().name(), 1L, Long::sum);
        }

        Map<String, Long> byType = new LinkedHashMap<>();
        for (InvitationType t : InvitationType.values()) byType.put(t.name(), 0L);
        for (Invitation i : all) {
            if (i.getType() != null) byType.merge(i.getType().name(), 1L, Long::sum);
        }

        // Invitations created per month, last 12 months (oldest first).
        Map<String, Long> byMonth = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(LocalDate.now()).minusMonths(11);
        for (int i = 0; i < 12; i++) { byMonth.put(cursor.toString(), 0L); cursor = cursor.plusMonths(1); }
        for (Invitation i : all) {
            if (i.getCreatedAt() == null) continue;
            byMonth.computeIfPresent(YearMonth.from(i.getCreatedAt()).toString(), (k, v) -> v + 1);
        }

        long accepted  = byStatus.getOrDefault("ACCEPTED", 0L);
        long declined  = byStatus.getOrDefault("DECLINED", 0L);
        long delivered = byStatus.getOrDefault("SENT", 0L) + accepted + declined;
        long answered  = accepted + declined;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", all.size());
        out.put("byStatus", byStatus);
        out.put("byType", byType);
        out.put("byMonth", byMonth);
        // Funnel: created → delivered → answered → accepted
        out.put("delivered", delivered);
        out.put("answered", answered);
        out.put("accepted", accepted);
        out.put("acceptanceRate", answered == 0 ? null : Math.round(accepted * 1000.0 / answered) / 10.0);
        out.put("failed", byStatus.getOrDefault("FAILED", 0L));
        out.put("contacts", contactRepository.count());
        return ResponseEntity.ok(out);
    }
}
