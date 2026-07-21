package com.medianet.programme.service;

import com.medianet.programme.dto.PitchSubmissionDto;
import com.medianet.programme.dto.PitchSubmissionRequest;
import com.medianet.programme.entity.PitchStatus;
import com.medianet.programme.entity.PitchSubmission;
import com.medianet.programme.entity.PitchKind;
import com.medianet.programme.entity.ProgrammePhase;
import com.medianet.programme.repository.PitchSubmissionRepository;
import com.medianet.programme.repository.ProgrammePhaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Porteur pitch submissions for presentation days. A submission is upserted per
 * (porteur, session), carries the video + transcript, and holds the AI analysis
 * result once run.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PitchService {

    private final PitchSubmissionRepository pitchRepository;
    private final ProgrammePhaseRepository  phaseRepository;

    /** Default number of TRAINING videos a porteur may analyse per session when
     *  the admin hasn't set a session-specific cap. */
    static final int DEFAULT_MAX_TRAINING = 3;

    // ── Porteur ──────────────────────────────────────────────────────────────

    /**
     * Create or update the caller's submission.
     * <p>FINAL pitches are upserted (one per porteur+session). TRAINING pitches
     * are multiple up to the session's {@code maxTrainingVideos} cap.
     * <p>Once the FINAL pitch has been sent for a session, that session locks:
     * the final can no longer be replaced and no further TRAINING run may be
     * uploaded (the practice phase is closed).
     */
    public PitchSubmissionDto upsertOwn(Long porteurId, String porteurName, PitchSubmissionRequest req) {
        if (req.getProgrammeId() == null) throw new IllegalArgumentException("programmeId requis");

        PitchKind kind = parseKind(req.getKind());
        PitchSubmission sub = null;
        if (req.getId() != null) {
            sub = pitchRepository.findById(req.getId())
                    .filter(s -> Objects.equals(s.getPorteurId(), porteurId))
                    .orElse(null);
        } else if (kind == PitchKind.FINAL && req.getSessionId() != null) {
            sub = pitchRepository.findByPorteurIdAndSessionIdAndKind(porteurId, req.getSessionId(), PitchKind.FINAL).orElse(null);
        }

        // ── Lock rules (only when creating/replacing against a session) ─────────
        if (req.getSessionId() != null) {
            boolean finalSent = pitchRepository
                    .findByPorteurIdAndSessionIdAndKind(porteurId, req.getSessionId(), PitchKind.FINAL)
                    .map(PitchService::isSent).orElse(false);
            boolean editingExisting = sub != null && sub.getId() != null;

            if (finalSent) {
                // The session is closed once the real pitch is in. Re-sending the same
                // FINAL row (editingExisting) is blocked too — it can't be replaced.
                if (kind == PitchKind.FINAL)
                    throw new IllegalStateException(
                            "Votre pitch final a déjà été envoyé pour cette session — il ne peut plus être remplacé.");
                throw new IllegalStateException(
                        "Votre pitch final a été envoyé : la phase d'entraînement est clôturée pour cette session.");
            }

            // Training cap — only when creating a NEW practice run (not editing one).
            if (kind == PitchKind.TRAINING && !editingExisting) {
                long used = pitchRepository
                        .findByPorteurIdAndSessionIdOrderByCreatedAtAsc(porteurId, req.getSessionId())
                        .stream().filter(s -> s.getKind() == PitchKind.TRAINING).count();
                int max = resolveMaxTraining(req.getSessionId());
                if (used >= max)
                    throw new IllegalStateException(
                            "Limite de vidéos d'entraînement atteinte pour cette session (" + max + "). "
                            + "Passez au pitch final quand vous êtes prêt.");
            }
        }

        if (sub == null) {
            sub = PitchSubmission.builder()
                    .porteurId(porteurId)
                    .porteurName(porteurName)
                    .programmeId(req.getProgrammeId())
                    .sessionId(req.getSessionId())
                    .kind(kind)
                    .status(PitchStatus.DRAFT)
                    .build();
        }
        if (req.getOrganizationId() != null) sub.setOrganizationId(req.getOrganizationId());
        if (req.getCompanyName()    != null) sub.setCompanyName(req.getCompanyName());
        if (req.getProjectName()    != null) sub.setProjectName(req.getProjectName());
        if (req.getTitle()          != null) sub.setTitle(req.getTitle());
        if (req.getVideoUrl()       != null) sub.setVideoUrl(req.getVideoUrl());
        if (req.getVideoFilename()  != null) sub.setVideoFilename(req.getVideoFilename());
        if (req.getTranscript()     != null) sub.setTranscript(req.getTranscript());
        if (req.getNotes()          != null) sub.setNotes(req.getNotes());
        if (req.getStatus() != null) {
            try { sub.setStatus(PitchStatus.valueOf(req.getStatus().toUpperCase())); }
            catch (IllegalArgumentException ignored) { /* keep current */ }
        } else if (sub.getStatus() == PitchStatus.DRAFT
                && sub.getVideoUrl() != null && !sub.getVideoUrl().isBlank()) {
            sub.setStatus(PitchStatus.SUBMITTED);
        }
        return toDto(pitchRepository.save(sub));
    }

    /**
     * Persist the AI analysis result (+ auto-transcript / metrics) — caller must
     * own the submission or be an admin. Used by the media/AI pipeline.
     */
    public PitchSubmissionDto saveAnalysis(Long submissionId, Long callerId, boolean isAdmin,
                                           Double aiScore, String aiAnalysisJson,
                                           String transcript, Boolean autoTranscribed, Integer durationSeconds,
                                           String segmentsJson) {
        PitchSubmission sub = requireOwnedOrAdmin(submissionId, callerId, isAdmin);
        if (aiScore != null)        sub.setAiScore(aiScore);
        if (aiAnalysisJson != null) sub.setAiAnalysisJson(aiAnalysisJson);
        if (transcript != null && !transcript.isBlank()) sub.setTranscript(transcript);
        if (autoTranscribed != null) sub.setAutoTranscribed(autoTranscribed);
        if (durationSeconds != null) sub.setDurationSeconds(durationSeconds);
        if (segmentsJson != null && !segmentsJson.isBlank()) sub.setSegmentsJson(segmentsJson);
        sub.setAiEnhanced(true);
        sub.setAnalyzedAt(LocalDateTime.now());
        sub.setStatus(PitchStatus.ANALYZED);
        return toDto(pitchRepository.save(sub));
    }

    /** Flip a submission to PROCESSING / FAILED (owner or admin). */
    public PitchSubmissionDto setStatus(Long submissionId, Long callerId, boolean isAdmin, PitchStatus status) {
        PitchSubmission sub = requireOwnedOrAdmin(submissionId, callerId, isAdmin);
        sub.setStatus(status);
        return toDto(pitchRepository.save(sub));
    }

    /** Archive / unarchive a submission (owner or admin). Archived videos stay
     *  fully viewable but move out of the active session view into the archive. */
    public PitchSubmissionDto setArchived(Long submissionId, Long callerId, boolean isAdmin, boolean archived) {
        PitchSubmission sub = requireOwnedOrAdmin(submissionId, callerId, isAdmin);
        sub.setArchived(archived);
        return toDto(pitchRepository.save(sub));
    }

    /** Soft-delete a submission (owner or admin) → moves to the trash, restorable. */
    public void softDelete(Long submissionId, Long callerId, boolean isAdmin) {
        PitchSubmission sub = requireOwnedOrAdmin(submissionId, callerId, isAdmin);
        sub.setDeletedAt(LocalDateTime.now());
        pitchRepository.save(sub);
    }

    private static PitchKind parseKind(String kind) {
        if (kind == null || kind.isBlank()) return PitchKind.FINAL;
        try { return PitchKind.valueOf(kind.toUpperCase()); }
        catch (IllegalArgumentException e) { return PitchKind.FINAL; }
    }

    /** A submission is "sent" once it carries a video and left the DRAFT state. */
    private static boolean isSent(PitchSubmission s) {
        return s != null && s.getVideoUrl() != null && !s.getVideoUrl().isBlank()
                && s.getStatus() != null && s.getStatus() != PitchStatus.DRAFT;
    }

    /** The training cap for a session: the admin's value, or the default. */
    private int resolveMaxTraining(Long sessionId) {
        Integer configured = phaseRepository.findById(sessionId)
                .map(ProgrammePhase::getMaxTrainingVideos).orElse(null);
        return (configured != null && configured > 0) ? configured : DEFAULT_MAX_TRAINING;
    }

    @Transactional(readOnly = true)
    public List<PitchSubmissionDto> getMine(Long porteurId) {
        return pitchRepository.findByPorteurIdOrderByUpdatedAtDesc(porteurId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PitchSubmissionDto getOne(Long submissionId, Long callerId, boolean isAdmin) {
        return toDto(requireOwnedOrAdmin(submissionId, callerId, isAdmin));
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PitchSubmissionDto> list(Long programmeId, Long sessionId) {
        List<PitchSubmission> subs;
        if (sessionId != null)        subs = pitchRepository.findBySessionIdOrderByUpdatedAtDesc(sessionId);
        else if (programmeId != null) subs = pitchRepository.findByProgrammeIdOrderByUpdatedAtDesc(programmeId);
        else                          subs = pitchRepository.findAll();
        return subs.stream().map(this::toDto).collect(Collectors.toList());
    }

    /**
     * Presentation sessions of a programme (PITCH_DAY / DEMO_DAY, or any session
     * explicitly flagged for pitch collection), with the caller's own submission
     * attached per session. Drives the porteur's pitch page.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> presentationsForProgramme(Long programmeId, Long porteurId) {
        List<ProgrammePhase> sessions = phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(programmeId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ProgrammePhase s : sessions) {
            // The checkbox decides — NOT the session type. Any session flagged for
            // video analysis opens pitch uploads.
            if (!Boolean.TRUE.equals(s.getCollectPitchVideos())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessionId", s.getId());
            m.put("title", s.getTitle());
            m.put("sessionType", s.getSessionType() != null ? s.getSessionType().name() : null);
            m.put("startDate", s.getStartDate());
            m.put("endDate", s.getEndDate());
            m.put("location", s.getLocation());
            m.put("collectPitchVideos", true);
            m.put("pitchDeadline", s.getPitchDeadline());
            int maxTraining = resolveMaxTraining(s.getId());
            m.put("maxTrainingVideos", maxTraining);
            boolean deadlinePassed = s.getPitchDeadline() != null
                    && s.getPitchDeadline().isBefore(java.time.LocalDate.now());
            m.put("open", !deadlinePassed);
            if (porteurId != null) {
                // All of the porteur's runs for this session (training + final).
                List<PitchSubmission> raw = pitchRepository
                        .findByPorteurIdAndSessionIdOrderByCreatedAtAsc(porteurId, s.getId());
                List<PitchSubmissionDto> subs = raw.stream().map(this::toDto).collect(Collectors.toList());
                m.put("submissions", subs);
                subs.stream().filter(d -> "FINAL".equals(d.getKind())).findFirst()
                        .ifPresent(d -> m.put("submission", d));

                long trainingCount = raw.stream().filter(x -> x.getKind() == PitchKind.TRAINING).count();
                boolean finalSubmitted = raw.stream()
                        .anyMatch(x -> x.getKind() == PitchKind.FINAL && isSent(x));
                m.put("trainingCount", trainingCount);
                m.put("finalSubmitted", finalSubmitted);
                // Practice phase closes once the real pitch is in (or the deadline passed).
                m.put("trainingClosed", finalSubmitted || deadlinePassed);
                m.put("canUploadTraining", !deadlinePassed && !finalSubmitted && trainingCount < maxTraining);
                m.put("canUploadFinal", !deadlinePassed && !finalSubmitted);
            }
            out.add(m);
        }
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private PitchSubmission requireOwnedOrAdmin(Long submissionId, Long callerId, boolean isAdmin) {
        PitchSubmission sub = pitchRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Soumission introuvable : " + submissionId));
        if (!isAdmin && !Objects.equals(sub.getPorteurId(), callerId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous ne pouvez accéder qu'à vos propres présentations.");
        }
        return sub;
    }

    private PitchSubmissionDto toDto(PitchSubmission s) {
        return PitchSubmissionDto.builder()
                .id(s.getId())
                .programmeId(s.getProgrammeId())
                .sessionId(s.getSessionId())
                .kind(s.getKind() != null ? s.getKind().name() : PitchKind.FINAL.name())
                .porteurId(s.getPorteurId())
                .porteurName(s.getPorteurName())
                .porteurEmail(s.getPorteurEmail())
                .organizationId(s.getOrganizationId())
                .companyName(s.getCompanyName())
                .projectName(s.getProjectName())
                .title(s.getTitle())
                .videoUrl(s.getVideoUrl())
                .videoFilename(s.getVideoFilename())
                .transcript(s.getTranscript())
                .autoTranscribed(s.getAutoTranscribed())
                .segmentsJson(s.getSegmentsJson())
                .durationSeconds(s.getDurationSeconds())
                .notes(s.getNotes())
                .status(s.getStatus() != null ? s.getStatus().name() : PitchStatus.DRAFT.name())
                .aiScore(s.getAiScore())
                .aiAnalysisJson(s.getAiAnalysisJson())
                .aiEnhanced(s.getAiEnhanced())
                .archived(Boolean.TRUE.equals(s.getArchived()))
                .analyzedAt(s.getAnalyzedAt())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
