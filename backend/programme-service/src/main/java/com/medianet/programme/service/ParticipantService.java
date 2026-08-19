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
    private final com.medianet.programme.repository.ProgrammeRepository programmeRepository;
    private final com.medianet.programme.repository.CoachingPlanRepository coachingPlanRepository;
    private final com.medianet.programme.repository.CoachingNoteRepository coachingNoteRepository;
    private final com.medianet.programme.repository.CoachingMeetingRepository coachingMeetingRepository;
    private final com.medianet.programme.repository.CoachingReviewRepository coachingReviewRepository;
    private final RestTemplate restTemplate;

    @Value("${CANDIDATURE_SERVICE_URL:http://candidature-service:8083}")
    private String candidatureUrl;
    @Value("${AUTH_SERVICE_URL:http://auth-service:8081}")
    private String authUrl;

    /** Roster for a programme — syncs from accepted candidatures first, then returns. */
    public List<ProgrammeParticipantDto> listForProgramme(Long programmeId) {
        syncFromCandidatures(programmeId);
        return repo.findByProgrammeId(programmeId).stream().map(this::toDto).collect(Collectors.toList());
    }

    /** The programmes a given organisation participates in (for its FO profile). */
    @Transactional(readOnly = true)
    public List<ProgrammeParticipantDto> listForOrganization(Long organizationId) {
        return repo.findByOrganizationId(organizationId).stream().map(this::toDto).collect(Collectors.toList());
    }

    /** The participations a given mentor is the « vis-à-vis » of (across programmes). */
    @Transactional(readOnly = true)
    public List<ProgrammeParticipantDto> myMentees(Long mentorUserId) {
        if (mentorUserId == null) return List.of();
        return repo.findByMentorUserId(mentorUserId).stream().map(this::toDto).collect(Collectors.toList());
    }

    /** All my coaching engagements — participations where I'm the mentor OR the porteur. */
    @Transactional(readOnly = true)
    public List<ProgrammeParticipantDto> myEngagements(Long userId) {
        if (userId == null) return List.of();
        var map = new java.util.LinkedHashMap<Long, ProgrammeParticipant>();
        repo.findByMentorUserId(userId).forEach(p -> map.put(p.getId(), p));
        repo.findByPorteurUserId(userId).forEach(p -> map.put(p.getId(), p));
        return map.values().stream().map(this::toDto).collect(Collectors.toList());
    }

    /** One participation (for the coaching workspace header). Gated to its people. */
    @Transactional(readOnly = true)
    public ProgrammeParticipantDto getOne(Long participantId, Long viewer, boolean admin) {
        ProgrammeParticipant p = find(participantId);
        if (!canParticipate(p, viewer, admin))
            throw new org.springframework.security.access.AccessDeniedException("Accès refusé.");
        return toDto(p);
    }

    public ProgrammeParticipantDto assignMentor(Long participantId, Long mentorUserId) {
        ProgrammeParticipant p = find(participantId);
        p.setMentorUserId(mentorUserId); // null clears
        p.setMentorName(mentorUserId == null ? null : lookupUserName(mentorUserId)); // denormalised snapshot
        return toDto(repo.save(p));
    }

    public ProgrammeParticipantDto setStatus(Long participantId, String status) {
        ProgrammeParticipant p = find(participantId);
        if (status != null && !status.isBlank()) p.setStatus(status.trim().toUpperCase());
        return toDto(repo.save(p));
    }

    // ── Coaching (scoped to the participation) ───────────────────────────────

    @Transactional(readOnly = true)
    public com.medianet.programme.dto.CoachingDto getCoaching(Long participantId, Long viewerUserId, boolean admin) {
        ProgrammeParticipant p = find(participantId);
        if (!canView(p, viewerUserId, admin))
            throw new org.springframework.security.access.AccessDeniedException("Accès au suivi refusé.");
        var plan = coachingPlanRepository.findByParticipantId(participantId).orElse(null);
        var notes = coachingNoteRepository.findByParticipantIdOrderBySessionDateDescIdDesc(participantId);
        return com.medianet.programme.dto.CoachingDto.builder()
                .plan(plan == null ? null : com.medianet.programme.dto.CoachingPlanDto.builder()
                        .milestonesJson(plan.getMilestonesJson()).notes(plan.getNotes()).updatedAt(plan.getUpdatedAt()).build())
                .notes(notes.stream().map(this::toNoteDto).collect(Collectors.toList()))
                .canEdit(canEdit(p, viewerUserId, admin))
                .build();
    }

    public com.medianet.programme.dto.CoachingPlanDto upsertCoachingPlan(
            Long participantId, Long viewerUserId, boolean admin, com.medianet.programme.dto.UpdateCoachingPlanRequest req) {
        ProgrammeParticipant p = find(participantId);
        assertCoach(p, viewerUserId, admin);
        var plan = coachingPlanRepository.findByParticipantId(participantId)
                .orElseGet(() -> com.medianet.programme.entity.CoachingPlan.builder().participantId(participantId).build());
        if (req.getMilestonesJson() != null) plan.setMilestonesJson(req.getMilestonesJson());
        if (req.getNotes() != null) plan.setNotes(req.getNotes());
        var saved = coachingPlanRepository.save(plan);
        return com.medianet.programme.dto.CoachingPlanDto.builder()
                .milestonesJson(saved.getMilestonesJson()).notes(saved.getNotes()).updatedAt(saved.getUpdatedAt()).build();
    }

    public com.medianet.programme.dto.CoachingNoteDto addCoachingNote(
            Long participantId, Long viewerUserId, String authorName, boolean admin, com.medianet.programme.dto.CoachingNoteRequest req) {
        ProgrammeParticipant p = find(participantId);
        assertCoach(p, viewerUserId, admin);
        var n = com.medianet.programme.entity.CoachingNote.builder()
                .participantId(participantId)
                .authorUserId(viewerUserId)
                .authorName(authorName)
                .sessionDate(req.getSessionDate() != null ? req.getSessionDate() : java.time.LocalDate.now())
                .title(req.getTitle()).content(req.getContent()).nextSteps(req.getNextSteps())
                .build();
        return toNoteDto(coachingNoteRepository.save(n));
    }

    public com.medianet.programme.dto.CoachingNoteDto updateCoachingNote(
            Long participantId, Long noteId, Long viewerUserId, boolean admin, com.medianet.programme.dto.CoachingNoteRequest req) {
        ProgrammeParticipant p = find(participantId);
        assertCoach(p, viewerUserId, admin);
        var n = coachingNoteRepository.findById(noteId)
                .filter(x -> participantId.equals(x.getParticipantId()))
                .orElseThrow(() -> new IllegalArgumentException("Note introuvable"));
        if (req.getSessionDate() != null) n.setSessionDate(req.getSessionDate());
        if (req.getTitle() != null)       n.setTitle(req.getTitle());
        if (req.getContent() != null)     n.setContent(req.getContent());
        if (req.getNextSteps() != null)   n.setNextSteps(req.getNextSteps());
        return toNoteDto(coachingNoteRepository.save(n));
    }

    public void deleteCoachingNote(Long participantId, Long noteId, Long viewerUserId, boolean admin) {
        ProgrammeParticipant p = find(participantId);
        assertCoach(p, viewerUserId, admin);
        coachingNoteRepository.findById(noteId)
                .filter(n -> participantId.equals(n.getParticipantId()))
                .ifPresent(coachingNoteRepository::delete);
    }

    private boolean canView(ProgrammeParticipant p, Long viewer, boolean admin) {
        return admin || (viewer != null && (viewer.equals(p.getMentorUserId()) || viewer.equals(p.getPorteurUserId())));
    }
    private boolean canEdit(ProgrammeParticipant p, Long viewer, boolean admin) {
        return admin || (viewer != null && viewer.equals(p.getMentorUserId()));
    }
    private void assertCoach(ProgrammeParticipant p, Long viewer, boolean admin) {
        if (!canEdit(p, viewer, admin))
            throw new org.springframework.security.access.AccessDeniedException("Seul le référent (mentor) peut modifier le suivi.");
    }
    private com.medianet.programme.dto.CoachingNoteDto toNoteDto(com.medianet.programme.entity.CoachingNote n) {
        return com.medianet.programme.dto.CoachingNoteDto.builder()
                .id(n.getId()).authorUserId(n.getAuthorUserId()).authorName(n.getAuthorName())
                .sessionDate(n.getSessionDate()).title(n.getTitle()).content(n.getContent())
                .nextSteps(n.getNextSteps()).createdAt(n.getCreatedAt()).build();
    }

    // ── Meetings (mentor ↔ porteur, scoped to the participation) ─────────────

    @Transactional(readOnly = true)
    public List<com.medianet.programme.dto.CoachingMeetingDto> listMeetings(Long participantId, Long viewer, boolean admin) {
        ProgrammeParticipant p = find(participantId);
        assertParticipate(p, viewer, admin);
        return coachingMeetingRepository.findByParticipantIdOrderByProposedDateDescIdDesc(participantId)
                .stream().map(m -> toMeetingDto(m, p)).collect(Collectors.toList());
    }

    public com.medianet.programme.dto.CoachingMeetingDto createMeeting(
            Long participantId, Long viewer, String viewerName, boolean admin,
            com.medianet.programme.dto.CoachingMeetingRequest req) {
        ProgrammeParticipant p = find(participantId);
        assertParticipate(p, viewer, admin);
        var m = com.medianet.programme.entity.CoachingMeeting.builder()
                .participantId(participantId)
                .proposedDate(req.getProposedDate()).proposedTime(req.getProposedTime())
                .location(req.getLocation()).note(req.getNote())
                .requestedByUserId(viewer).requestedByName(viewerName)
                .status("PENDING").build();
        return toMeetingDto(coachingMeetingRepository.save(m), p);
    }

    public com.medianet.programme.dto.CoachingMeetingDto respondMeeting(Long meetingId, Long viewer, boolean admin, String status) {
        var m = coachingMeetingRepository.findById(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Rendez-vous introuvable"));
        ProgrammeParticipant p = find(m.getParticipantId());
        assertParticipate(p, viewer, admin);
        String s = status == null ? "" : status.trim().toUpperCase();
        if (java.util.Set.of("ACCEPTED", "DECLINED", "CANCELLED", "PENDING").contains(s)) m.setStatus(s);
        return toMeetingDto(coachingMeetingRepository.save(m), p);
    }

    /** Meetings across the caller's participations (mentor or porteur) — for calendars. */
    @Transactional(readOnly = true)
    public List<com.medianet.programme.dto.CoachingMeetingDto> myMeetings(Long viewerUserId) {
        if (viewerUserId == null) return List.of();
        var parts = new java.util.LinkedHashMap<Long, ProgrammeParticipant>();
        repo.findByMentorUserId(viewerUserId).forEach(p -> parts.put(p.getId(), p));
        repo.findByPorteurUserId(viewerUserId).forEach(p -> parts.put(p.getId(), p));
        if (parts.isEmpty()) return List.of();
        return coachingMeetingRepository.findByParticipantIdInOrderByProposedDateAscIdAsc(parts.keySet())
                .stream().map(m -> toMeetingDto(m, parts.get(m.getParticipantId()))).collect(Collectors.toList());
    }

    private boolean canParticipate(ProgrammeParticipant p, Long viewer, boolean admin) {
        return admin || (viewer != null && (viewer.equals(p.getMentorUserId()) || viewer.equals(p.getPorteurUserId())));
    }
    private void assertParticipate(ProgrammeParticipant p, Long viewer, boolean admin) {
        if (!canParticipate(p, viewer, admin))
            throw new org.springframework.security.access.AccessDeniedException("Accès au rendez-vous refusé.");
    }
    // ── Reviews (mentor / porteur / member feedback on a participation) ──────

    @Transactional(readOnly = true)
    public List<com.medianet.programme.dto.CoachingReviewDto> listReviews(Long participantId, Long viewer, boolean admin) {
        ProgrammeParticipant p = find(participantId);
        assertParticipate(p, viewer, admin);
        return coachingReviewRepository.findByParticipantIdOrderByCreatedAtDescIdDesc(participantId)
                .stream().map(this::toReviewDto).collect(Collectors.toList());
    }

    public com.medianet.programme.dto.CoachingReviewDto addReview(
            Long participantId, Long viewer, String viewerName, boolean admin,
            com.medianet.programme.dto.CoachingReviewRequest req) {
        ProgrammeParticipant p = find(participantId);
        assertParticipate(p, viewer, admin);
        String role = (viewer != null && viewer.equals(p.getMentorUserId())) ? "MENTOR"
                : (viewer != null && viewer.equals(p.getPorteurUserId())) ? "PORTEUR"
                : admin ? "ADMIN" : "MEMBER";
        Integer rating = req.getRating();
        if (rating != null) rating = Math.max(1, Math.min(5, rating));
        var r = com.medianet.programme.entity.CoachingReview.builder()
                .participantId(participantId).authorUserId(viewer).authorName(viewerName).authorRole(role)
                .targetType(req.getTargetType() == null ? "STARTUP" : req.getTargetType())
                .rating(rating).comment(req.getComment()).build();
        return toReviewDto(coachingReviewRepository.save(r));
    }

    private com.medianet.programme.dto.CoachingReviewDto toReviewDto(com.medianet.programme.entity.CoachingReview r) {
        return com.medianet.programme.dto.CoachingReviewDto.builder()
                .id(r.getId()).authorUserId(r.getAuthorUserId()).authorName(r.getAuthorName())
                .authorRole(r.getAuthorRole()).targetType(r.getTargetType())
                .rating(r.getRating()).comment(r.getComment()).createdAt(r.getCreatedAt()).build();
    }

    private com.medianet.programme.dto.CoachingMeetingDto toMeetingDto(com.medianet.programme.entity.CoachingMeeting m, ProgrammeParticipant p) {
        return com.medianet.programme.dto.CoachingMeetingDto.builder()
                .id(m.getId()).participantId(m.getParticipantId())
                .proposedDate(m.getProposedDate()).proposedTime(m.getProposedTime())
                .location(m.getLocation()).note(m.getNote())
                .requestedByUserId(m.getRequestedByUserId()).requestedByName(m.getRequestedByName())
                .status(m.getStatus()).createdAt(m.getCreatedAt())
                .programmeId(p != null ? p.getProgrammeId() : null)
                .programmeName(p != null ? programmeName(p.getProgrammeId()) : null)
                .organizationId(p != null ? p.getOrganizationId() : null)
                .organizationName(p != null ? p.getOrganizationName() : null)
                .build();
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
                .programmeName(programmeName(p.getProgrammeId()))
                .organizationId(p.getOrganizationId())
                .organizationName(p.getOrganizationName())
                .porteurUserId(p.getPorteurUserId())
                .porteurName(p.getPorteurName())
                .porteurEmail(p.getPorteurEmail())
                .mentorUserId(p.getMentorUserId())
                .mentorName(p.getMentorName())
                .status(p.getStatus())
                .joinedAt(p.getJoinedAt())
                .build();
    }

    private String programmeName(Long programmeId) {
        if (programmeId == null) return null;
        return programmeRepository.findById(programmeId).map(pr -> pr.getTitle()).orElse(null);
    }

    /** One-off user-name lookup against auth-service (used to snapshot the mentor name). */
    private String lookupUserName(Long userId) {
        String authz = currentAuthorizationHeader();
        if (authz == null) return null;
        try {
            HttpHeaders h = new HttpHeaders();
            h.set("Authorization", authz);
            var resp = restTemplate.exchange(authUrl + "/api/auth/users/" + userId,
                    HttpMethod.GET, new HttpEntity<>(h), new ParameterizedTypeReference<Map<String, Object>>() {});
            Map<String, Object> u = resp.getBody();
            if (u == null) return null;
            String name = (nz(u.get("firstName")) + " " + nz(u.get("lastName"))).trim();
            return name.isBlank() ? str(u.get("email")) : name;
        } catch (Exception e) {
            log.warn("mentor name lookup failed for user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    private static String nz(Object o) { return o == null ? "" : String.valueOf(o); }

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
