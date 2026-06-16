package com.medianet.candidature.service;

import com.medianet.candidature.dto.*;
import com.medianet.candidature.entity.*;
import com.medianet.candidature.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class CandidatureService {

    private final CandidatureRepository candidatureRepository;
    private final EvaluationRepository  evaluationRepository;
    private final JuryAssignmentRepository juryAssignmentRepository;
    private final org.springframework.web.client.RestTemplate restTemplate;

    @org.springframework.beans.factory.annotation.Value("${PROGRAMME_SERVICE_URL:http://programme-service:8086}")
    private String programmeServiceUrl;

    // ── Submit ────────────────────────────────────────────────────────────────

    @Transactional
    public CandidatureDto submitCandidature(SubmitCandidatureRequest req,
                                            Long porteurId, String porteurEmail, String porteurName) {
        // Duplicate check: one candidature per porteur per programme
        if (req.getProgrammeId() != null) {
            candidatureRepository.findByPorteurIdAndProgrammeId(porteurId, req.getProgrammeId())
                    .ifPresent(c -> {
                        throw new IllegalStateException(
                                "You have already submitted a candidature for this programme");
                    });
        }

        // Applications are accepted ONLY while the programme's candidature session is
        // open. Verify with programme-service and bind this candidature to that session.
        if (req.getProgrammeId() != null) {
            verifyAcceptingAndBindSession(req);
        }

        // When the porteur applies to a specific session (phaseId), they MUST pick
        // an organisation. Programme-level applications keep the old behaviour.
        if (req.getPhaseId() != null && req.getOrganizationId() == null) {
            throw new IllegalArgumentException(
                    "An organization must be selected when applying to a candidature session");
        }

        Candidature candidature = Candidature.builder()
                // sessionId left null — session-service is deprecated
                .programmeId(req.getProgrammeId())
                .companyId(req.getCompanyId())
                .organizationId(req.getOrganizationId())
                .phaseId(req.getPhaseId())
                .porteurId(porteurId)
                .porteurEmail(porteurEmail)
                .porteurName(porteurName)
                // Section 1: Company & Team
                .companyName(req.getCompanyName())
                .contactEmail(req.getContactEmail())
                .contactPhone(req.getContactPhone())
                .founderName(req.getFounderName())
                .founderEmail(req.getFounderEmail())
                .coFounders(req.getCoFounders())
                .teamBackground(req.getTeamBackground())
                .engagementLevel(req.getEngagementLevel())
                // Section 2: Project
                .projectName(req.getProjectName())
                .projectDescription(req.getProjectDescription())
                .problemStatement(req.getProblemStatement())
                .solutionDescription(req.getSolutionDescription())
                .competitiveAdvantage(req.getCompetitiveAdvantage())
                .technologyDescription(req.getTechnologyDescription())
                .sector(req.getSector())
                .domain(req.getDomain())
                .currentStage(req.getCurrentStage())
                .teamSize(req.getTeamSize())
                .techStack(req.getTechStack())
                // Section 3: Market & Business
                .targetMarket(req.getTargetMarket())
                .hasCustomers(req.getHasCustomers())
                .hasPriorIncubation(req.getHasPriorIncubation())
                .priorIncubationDetails(req.getPriorIncubationDetails())
                .businessModel(req.getBusinessModel())
                .distributionChannels(req.getDistributionChannels())
                .fundingRequired(req.getFundingRequired())
                // Section 4: Motivation
                .motivation(req.getMotivation())
                .supportNeeds(req.getSupportNeeds())
                .otherNeeds(req.getOtherNeeds())
                .programmeExpectations(req.getProgrammeExpectations())
                .pitchDeckUrl(req.getPitchDeckUrl())
                .customAnswers(req.getCustomAnswers())
                .status(CandidatureStatus.PENDING)
                .build();

        return toDto(candidatureRepository.save(candidature), List.of(), List.of());
    }

    /** Calls programme-service (public GET) to enforce the candidature window and bind
     *  this candidature to the active candidature session. Fail-open on network error. */
    @SuppressWarnings("unchecked")
    private void verifyAcceptingAndBindSession(SubmitCandidatureRequest req) {
        try {
            Map<String, Object> prog = restTemplate.getForObject(
                    programmeServiceUrl + "/api/programmes/" + req.getProgrammeId(), Map.class);
            if (prog == null) return;
            if (Boolean.FALSE.equals(prog.get("acceptingApplications"))) {
                throw new IllegalStateException(
                        "Les candidatures ne sont pas ouvertes pour ce programme (hors de la session de candidature).");
            }
            Object csid = prog.get("candidatureSessionId");
            if (csid instanceof Number && req.getPhaseId() == null) {
                req.setPhaseId(((Number) csid).longValue());
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Programme {} acceptance check failed (allowing submit): {}",
                    req.getProgrammeId(), e.getMessage());
        }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public List<CandidatureDto> getAllCandidatures(CandidatureStatus status) {
        List<Candidature> candidatures = (status != null)
                ? candidatureRepository.findByStatusOrderBySubmittedAtDesc(status)
                : candidatureRepository.findAllByOrderBySubmittedAtDesc();
        return candidatures.stream().map(this::toDtoWithRelations).collect(Collectors.toList());
    }

    public List<CandidatureDto> getCandidaturesByProgramme(Long programmeId, CandidatureStatus status) {
        List<Candidature> candidatures = (status != null)
                ? candidatureRepository.findByProgrammeIdAndStatusOrderBySubmittedAtDesc(programmeId, status)
                : candidatureRepository.findByProgrammeIdOrderBySubmittedAtDesc(programmeId);
        return candidatures.stream().map(this::toDtoWithRelations).collect(Collectors.toList());
    }

    public List<CandidatureDto> getMyCandidatures(Long porteurId) {
        return candidatureRepository.findByPorteurId(porteurId).stream()
                .map(this::toDtoWithRelations).collect(Collectors.toList());
    }

    public CandidatureDto getCandidatureById(Long id) {
        Candidature c = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        return toDtoWithRelations(c);
    }

    public List<CandidatureDto> getMyJuryAssignments(Long juryId) {
        return juryAssignmentRepository.findByJuryId(juryId).stream().map(a -> {
            Candidature c = candidatureRepository.findById(a.getCandidatureId())
                    .orElseThrow(() -> new RuntimeException("Candidature not found"));
            return toDtoWithRelations(c);
        }).collect(Collectors.toList());
    }

    // ── Jury assignment ───────────────────────────────────────────────────────

    @Transactional
    public CandidatureDto assignJury(Long candidatureId, AssignJuryRequest request) {
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));

        // Additive: keep existing assignments (and their tokens); only create new
        // ones for emails not already assigned, so an admin can invite jurys across
        // multiple clicks without wiping previously-sent invitations.
        List<JuryAssignment> existing = juryAssignmentRepository.findByCandidatureId(candidatureId);

        for (JuryAssignmentItem item : request.getJuryAssignments()) {
            String email = item.getJuryEmail();
            JuryAssignment match = existing.stream()
                    .filter(a -> a.getJuryEmail() != null && a.getJuryEmail().equalsIgnoreCase(email))
                    .findFirst().orElse(null);
            if (match != null) {
                // Already assigned — refresh identity, keep the existing token/status.
                if (item.getJuryId() != null)   match.setJuryId(item.getJuryId());
                if (item.getJuryName() != null) match.setJuryName(item.getJuryName());
                if (request.getPhaseId() != null) match.setPhaseId(request.getPhaseId());
                // Backfill a token for legacy assignments created before tokens existed.
                if (match.getToken() == null)   match.setToken(UUID.randomUUID().toString());
                if (match.getStatus() == null)  match.setStatus("PENDING");
                juryAssignmentRepository.save(match);
            } else {
                JuryAssignment created = juryAssignmentRepository.save(JuryAssignment.builder()
                        .candidatureId(candidatureId)
                        .juryId(item.getJuryId())
                        .juryEmail(email)
                        .juryName(item.getJuryName())
                        .phaseId(request.getPhaseId())
                        .token(UUID.randomUUID().toString())
                        .status("PENDING")
                        .build());
                existing.add(created);
            }
        }

        candidature.setStatus(CandidatureStatus.UNDER_EVALUATION);
        candidatureRepository.save(candidature);

        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignmentDtos = juryAssignmentRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignmentDtos);
    }

    // ── Evaluate ──────────────────────────────────────────────────────────────

    @Transactional
    public CandidatureDto evaluateCandidature(Long candidatureId, Long juryId, EvaluationRequest req) {
        upsertEvaluation(candidatureId, juryId, req.getJuryEmail(), req.getJuryName(), req);
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        return toDtoWithRelations(candidature);
    }

    /**
     * Shared evaluation upsert used by both the logged-in JURY path (juryId set)
     * and the no-login token path (juryId null → matched by jury email). Saves the
     * evaluation and recomputes the candidature's average totalScore.
     */
    private void upsertEvaluation(Long candidatureId, Long juryId,
                                  String juryEmail, String juryName, EvaluationRequest req) {
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));

        Evaluation evaluation;
        if (juryId != null) {
            evaluation = evaluationRepository.findByCandidatureIdAndJuryId(candidatureId, juryId)
                    .orElse(Evaluation.builder()
                            .candidatureId(candidatureId)
                            .juryId(juryId)
                            .criteriaScores(new ArrayList<>())
                            .build());
        } else {
            // Token path — match the (account-less) jury by email.
            final String email = juryEmail;
            evaluation = evaluationRepository.findByCandidatureId(candidatureId).stream()
                    .filter(e -> e.getJuryId() == null && email != null
                            && email.equalsIgnoreCase(e.getJuryEmail()))
                    .findFirst()
                    .orElse(Evaluation.builder()
                            .candidatureId(candidatureId)
                            .criteriaScores(new ArrayList<>())
                            .build());
        }

        evaluation.setJuryEmail(juryEmail);
        evaluation.setJuryName(juryName);
        evaluation.setComment(req.getComment());

        if (req.getCriteriaScores() != null && !req.getCriteriaScores().isEmpty()) {
            // Dynamic mode — build CriteriaScore entities from request
            List<CriteriaScore> scores = req.getCriteriaScores().stream()
                    .map(r -> CriteriaScore.builder()
                            .criteriaId(r.getCriteriaId())
                            .criteriaName(r.getCriteriaName())
                            .score(r.getScore())
                            .weight(r.getWeight())
                            .build())
                    .collect(Collectors.toList());
            evaluation.setCriteriaScores(scores);
            // Clear legacy fields when using dynamic mode
            evaluation.setInnovationScore(null);
            evaluation.setFeasibilityScore(null);
            evaluation.setMarketImpactScore(null);
            evaluation.setTeamQualityScore(null);
        } else {
            // Legacy mode
            evaluation.setInnovationScore(req.getInnovationScore());
            evaluation.setFeasibilityScore(req.getFeasibilityScore());
            evaluation.setMarketImpactScore(req.getMarketImpactScore());
            evaluation.setTeamQualityScore(req.getTeamQualityScore());
            evaluation.setCriteriaScores(new ArrayList<>());
        }

        evaluation.calculateWeightedScore();
        evaluationRepository.save(evaluation);

        // Recalculate candidature total score = average of all evaluations' weightedScores
        List<Evaluation> allEvals = evaluationRepository.findByCandidatureId(candidatureId);
        OptionalDouble avg = allEvals.stream()
                .filter(e -> e.getWeightedScore() != null)
                .mapToDouble(Evaluation::getWeightedScore)
                .average();
        avg.ifPresent(v -> {
            candidature.setTotalScore(v);
            candidatureRepository.save(candidature);
        });
    }

    // ── Token-based (no-login) evaluation ───────────────────────────────────────

    @Transactional(readOnly = true)
    public TokenEvaluationDto getEvaluationByToken(String token) {
        JuryAssignment ja = juryAssignmentRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Lien d'évaluation invalide ou expiré"));
        Candidature c = candidatureRepository.findById(ja.getCandidatureId())
                .orElseThrow(() -> new IllegalArgumentException("Candidature introuvable"));

        EvaluationDto existing = evaluationRepository.findByCandidatureId(c.getId()).stream()
                .filter(e -> e.getJuryId() == null && ja.getJuryEmail() != null
                        && ja.getJuryEmail().equalsIgnoreCase(e.getJuryEmail()))
                .findFirst().map(this::toEvaluationDto).orElse(null);

        return TokenEvaluationDto.builder()
                .candidatureId(c.getId())
                .projectName(c.getProjectName())
                .companyName(c.getCompanyName())
                .porteurName(c.getPorteurName())
                .programmeId(c.getProgrammeId())
                .phaseId(ja.getPhaseId())
                .candidatureStatus(c.getStatus() != null ? c.getStatus().name() : null)
                .juryName(ja.getJuryName())
                .juryEmail(ja.getJuryEmail())
                .submitted("SUBMITTED".equals(ja.getStatus()) || existing != null)
                .evaluation(existing)
                .build();
    }

    @Transactional
    public TokenEvaluationDto submitEvaluationByToken(String token, EvaluationRequest req) {
        JuryAssignment ja = juryAssignmentRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Lien d'évaluation invalide ou expiré"));
        upsertEvaluation(ja.getCandidatureId(), null, ja.getJuryEmail(), ja.getJuryName(), req);
        ja.setStatus("SUBMITTED");
        juryAssignmentRepository.save(ja);
        return getEvaluationByToken(token);
    }

    // ── Accept / Reject ───────────────────────────────────────────────────────

    @Transactional
    public CandidatureDto acceptCandidature(Long id, Long adminId) {
        Candidature c = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        c.setStatus(CandidatureStatus.ACCEPTED);
        candidatureRepository.save(c);
        return toDtoWithRelations(c);
    }

    @Transactional
    public CandidatureDto rejectCandidature(Long id, String reason, Long adminId) {
        Candidature c = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        c.setStatus(CandidatureStatus.REJECTED);
        c.setRejectionReason(reason);
        candidatureRepository.save(c);
        return toDtoWithRelations(c);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public Map<String, Long> getStats() {
        return Map.of(
                "total",           candidatureRepository.count(),
                "pending",         candidatureRepository.countByStatus(CandidatureStatus.PENDING),
                "underEvaluation", candidatureRepository.countByStatus(CandidatureStatus.UNDER_EVALUATION),
                "accepted",        candidatureRepository.countByStatus(CandidatureStatus.ACCEPTED),
                "rejected",        candidatureRepository.countByStatus(CandidatureStatus.REJECTED)
        );
    }

    public Map<String, Long> getProgrammeStats(Long programmeId) {
        return Map.of(
                "total",           candidatureRepository.countByProgrammeId(programmeId),
                "pending",         candidatureRepository.countByProgrammeIdAndStatus(programmeId, CandidatureStatus.PENDING),
                "underEvaluation", candidatureRepository.countByProgrammeIdAndStatus(programmeId, CandidatureStatus.UNDER_EVALUATION),
                "accepted",        candidatureRepository.countByProgrammeIdAndStatus(programmeId, CandidatureStatus.ACCEPTED),
                "rejected",        candidatureRepository.countByProgrammeIdAndStatus(programmeId, CandidatureStatus.REJECTED)
        );
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private CandidatureDto toDtoWithRelations(Candidature c) {
        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(c.getId())
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(c.getId())
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(c, evals, assignments);
    }

    private CandidatureDto toDto(Candidature c, List<EvaluationDto> evals, List<JuryAssignmentDto> assignments) {
        return CandidatureDto.builder()
                .id(c.getId())
                .sessionId(c.getSessionId())
                .programmeId(c.getProgrammeId())
                .companyId(c.getCompanyId())
                .organizationId(c.getOrganizationId())
                .phaseId(c.getPhaseId())
                .porteurId(c.getPorteurId())
                .porteurEmail(c.getPorteurEmail())
                .porteurName(c.getPorteurName())
                // Section 1: Company & Team
                .companyName(c.getCompanyName())
                .contactEmail(c.getContactEmail())
                .contactPhone(c.getContactPhone())
                .founderName(c.getFounderName())
                .founderEmail(c.getFounderEmail())
                .coFounders(c.getCoFounders())
                .teamBackground(c.getTeamBackground())
                .engagementLevel(c.getEngagementLevel())
                // Section 2: Project
                .projectName(c.getProjectName())
                .projectDescription(c.getProjectDescription())
                .problemStatement(c.getProblemStatement())
                .solutionDescription(c.getSolutionDescription())
                .competitiveAdvantage(c.getCompetitiveAdvantage())
                .technologyDescription(c.getTechnologyDescription())
                .sector(c.getSector())
                .domain(c.getDomain())
                .currentStage(c.getCurrentStage())
                .teamSize(c.getTeamSize())
                .techStack(c.getTechStack())
                // Section 3: Market & Business
                .targetMarket(c.getTargetMarket())
                .hasCustomers(c.getHasCustomers())
                .hasPriorIncubation(c.getHasPriorIncubation())
                .priorIncubationDetails(c.getPriorIncubationDetails())
                .businessModel(c.getBusinessModel())
                .distributionChannels(c.getDistributionChannels())
                .fundingRequired(c.getFundingRequired())
                // Section 4: Motivation
                .motivation(c.getMotivation())
                .supportNeeds(c.getSupportNeeds())
                .otherNeeds(c.getOtherNeeds())
                .programmeExpectations(c.getProgrammeExpectations())
                .pitchDeckUrl(c.getPitchDeckUrl())
                .customAnswers(c.getCustomAnswers())
                .status(c.getStatus().name())
                .totalScore(c.getTotalScore())
                .rejectionReason(c.getRejectionReason())
                .submittedAt(c.getSubmittedAt())
                .updatedAt(c.getUpdatedAt())
                .evaluations(evals)
                .juryAssignments(assignments)
                .build();
    }

    private EvaluationDto toEvaluationDto(Evaluation e) {
        List<CriteriaScoreDto> scores = (e.getCriteriaScores() == null)
                ? List.of()
                : e.getCriteriaScores().stream()
                        .map(cs -> CriteriaScoreDto.builder()
                                .criteriaId(cs.getCriteriaId())
                                .criteriaName(cs.getCriteriaName())
                                .score(cs.getScore())
                                .weight(cs.getWeight())
                                .build())
                        .collect(Collectors.toList());

        return EvaluationDto.builder()
                .id(e.getId())
                .candidatureId(e.getCandidatureId())
                .juryId(e.getJuryId())
                .juryEmail(e.getJuryEmail())
                .juryName(e.getJuryName())
                .criteriaScores(scores)
                .innovationScore(e.getInnovationScore())
                .feasibilityScore(e.getFeasibilityScore())
                .marketImpactScore(e.getMarketImpactScore())
                .teamQualityScore(e.getTeamQualityScore())
                .weightedScore(e.getWeightedScore())
                .comment(e.getComment())
                .evaluatedAt(e.getEvaluatedAt())
                .build();
    }

    private JuryAssignmentDto toJuryAssignmentDto(JuryAssignment ja) {
        return JuryAssignmentDto.builder()
                .id(ja.getId())
                .candidatureId(ja.getCandidatureId())
                .juryId(ja.getJuryId())
                .juryEmail(ja.getJuryEmail())
                .juryName(ja.getJuryName())
                .token(ja.getToken())
                .status(ja.getStatus())
                .assignedAt(ja.getAssignedAt())
                .build();
    }
}
