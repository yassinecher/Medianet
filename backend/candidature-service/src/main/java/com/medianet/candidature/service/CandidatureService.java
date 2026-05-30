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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CandidatureService {

    private final CandidatureRepository candidatureRepository;
    private final EvaluationRepository  evaluationRepository;
    private final JuryAssignmentRepository juryAssignmentRepository;

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

        juryAssignmentRepository.deleteByCandidatureId(candidatureId);

        List<JuryAssignment> assignments = request.getJuryAssignments().stream()
                .map(item -> JuryAssignment.builder()
                        .candidatureId(candidatureId)
                        .juryId(item.getJuryId())
                        .juryEmail(item.getJuryEmail())
                        .juryName(item.getJuryName())
                        .build())
                .collect(Collectors.toList());

        juryAssignmentRepository.saveAll(assignments);
        candidature.setStatus(CandidatureStatus.UNDER_EVALUATION);
        candidatureRepository.save(candidature);

        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignmentDtos = assignments.stream()
                .map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignmentDtos);
    }

    // ── Evaluate ──────────────────────────────────────────────────────────────

    @Transactional
    public CandidatureDto evaluateCandidature(Long candidatureId, Long juryId, EvaluationRequest req) {
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));

        Evaluation evaluation = evaluationRepository
                .findByCandidatureIdAndJuryId(candidatureId, juryId)
                .orElse(Evaluation.builder()
                        .candidatureId(candidatureId)
                        .juryId(juryId)
                        .criteriaScores(new ArrayList<>())
                        .build());

        evaluation.setJuryEmail(req.getJuryEmail());
        evaluation.setJuryName(req.getJuryName());
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

        List<EvaluationDto> evals = allEvals.stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignments);
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
                .assignedAt(ja.getAssignedAt())
                .build();
    }
}
