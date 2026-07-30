package com.medianet.programme.service;

import com.medianet.programme.dto.ProgrammeParticipantDto;
import com.medianet.programme.entity.ProgrammeParticipant;
import com.medianet.programme.repository.ProgrammeParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * The participation roster of a programme (organisation × programme). It is kept
 * in sync with the ACCEPTED candidatures of the programme (pulled from
 * candidature-service), and carries the per-programme mentor assignment.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ParticipantService {

    private final ProgrammeParticipantRepository repo;
    private final RestTemplate restTemplate;

    @Value("${CANDIDATURE_SERVICE_URL:http://candidature-service:8083}")
    private String candidatureUrl;

    /** Roster for a programme — syncs from accepted candidatures first, then returns. */
    public List<ProgrammeParticipantDto> listForProgramme(Long programmeId) {
        syncFromCandidatures(programmeId);
        return repo.findByProgrammeId(programmeId).stream().map(this::toDto).collect(Collectors.toList());
    }

    /** The participations a given mentor is the « vis-à-vis » of (across programmes). */
    @Transactional(readOnly = true)
    public List<ProgrammeParticipantDto> myMentees(Long mentorUserId) {
        if (mentorUserId == null) return List.of();
        return repo.findByMentorUserId(mentorUserId).stream().map(this::toDto).collect(Collectors.toList());
    }

    public ProgrammeParticipantDto assignMentor(Long participantId, Long mentorUserId) {
        ProgrammeParticipant p = find(participantId);
        p.setMentorUserId(mentorUserId); // null clears
        return toDto(repo.save(p));
    }

    public ProgrammeParticipantDto setStatus(Long participantId, String status) {
        ProgrammeParticipant p = find(participantId);
        if (status != null && !status.isBlank()) p.setStatus(status.trim().toUpperCase());
        return toDto(repo.save(p));
    }

    // ── Sync from candidature-service ────────────────────────────────────────

    /**
     * Ensure a participant row exists for every ACCEPTED candidature of the
     * programme. Idempotent, additive (never deletes — an admin may keep an
     * alumnus/withdrawn participant). Best-effort: a candidature-service hiccup
     * just returns the rows we already have.
     */
    public void syncFromCandidatures(Long programmeId) {
        String authz = currentAuthorizationHeader();
        if (authz == null) return;
        try {
            HttpHeaders h = new HttpHeaders();
            h.set("Authorization", authz);
            var resp = restTemplate.exchange(
                    candidatureUrl + "/api/candidatures/programme/" + programmeId + "?status=ACCEPTED",
                    HttpMethod.GET, new HttpEntity<>(h),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            for (Map<String, Object> c : Optional.ofNullable(resp.getBody()).orElse(List.of())) {
                Long orgId = asLong(c.get("organizationId"));
                if (orgId == null) continue; // only orgs can participate
                String orgName = str(c.get("companyName"));
                if (orgName == null) orgName = str(c.get("projectName"));
                Long porteurId = asLong(c.get("porteurId"));
                String porteurName = str(c.get("porteurName"));
                String porteurEmail = str(c.get("porteurEmail"));

                ProgrammeParticipant p = repo.findByProgrammeIdAndOrganizationId(programmeId, orgId)
                        .orElseGet(() -> ProgrammeParticipant.builder()
                                .programmeId(programmeId).organizationId(orgId).status("ACTIVE").build());
                // Refresh the denormalised snapshot; never touch mentor/status here.
                if (orgName != null)      p.setOrganizationName(orgName);
                if (porteurId != null)    p.setPorteurUserId(porteurId);
                if (porteurName != null)  p.setPorteurName(porteurName);
                if (porteurEmail != null) p.setPorteurEmail(porteurEmail);
                repo.save(p);
            }
        } catch (Exception e) {
            log.warn("Participant sync failed for programme {}: {}", programmeId, e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ProgrammeParticipant find(Long id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Participant introuvable : " + id));
    }

    private ProgrammeParticipantDto toDto(ProgrammeParticipant p) {
        return ProgrammeParticipantDto.builder()
                .id(p.getId())
                .programmeId(p.getProgrammeId())
                .organizationId(p.getOrganizationId())
                .organizationName(p.getOrganizationName())
                .porteurUserId(p.getPorteurUserId())
                .porteurName(p.getPorteurName())
                .porteurEmail(p.getPorteurEmail())
                .mentorUserId(p.getMentorUserId())
                .status(p.getStatus())
                .joinedAt(p.getJoinedAt())
                .build();
    }

    private String currentAuthorizationHeader() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) {
            return sra.getRequest().getHeader("Authorization");
        }
        return null;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Long asLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
    }
}
