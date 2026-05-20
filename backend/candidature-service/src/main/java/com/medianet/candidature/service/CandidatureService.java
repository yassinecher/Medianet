package com.medianet.candidature.service;

import com.medianet.candidature.dto.*;
import com.medianet.candidature.entity.*;
import com.medianet.candidature.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CandidatureService {

    private final CandidatureRepository candidatureRepository;
    private final EvaluationRepository evaluationRepository;
    private final JuryAssignmentRepository juryAssignmentRepository;

    @Transactional
    public CandidatureDto submitCandidature(SubmitCandidatureRequest request,
                                             Long porteurId, String porteurEmail, String porteurName) {
        // Check if porteur already submitted to this session
        candidatureRepository.findByPorteurIdAndSessionId(porteurId, request.getSessionId())
                .ifPresent(c -> {
                    throw new IllegalStateException("You have already submitted a candidature for this session");
                });

        Candidature candidature = Candidature.builder()
                .sessionId(request.getSessionId())
                .porteurId(porteurId)
                .porteurEmail(porteurEmail)
                .porteurName(porteurName)
                .projectName(request.getProjectName())
                .projectDescription(request.getProjectDescription())
                .domain(request.getDomain())
                .targetMarket(request.getTargetMarket())
                .currentStage(request.getCurrentStage())
                .teamSize(request.getTeamSize())
                .techStack(request.getTechStack())
                .problemStatement(request.getProblemStatement())
                .solutionDescription(request.getSolutionDescription())
                .businessModel(request.getBusinessModel())
                .teamBackground(request.getTeamBackground())
                .status(CandidatureStatus.PENDING)
                .build();

        return toDto(candidatureRepository.save(candidature), List.of(), List.of());
    }

    public List<CandidatureDto> getAllCandidatures(CandidatureStatus status, Long sessionId) {
        List<Candidature> candidatures;
        if (sessionId != null && status != null) {
            candidatures = candidatureRepository.findBySessionIdAndStatusOrderBySubmittedAtDesc(sessionId, status);
        } else if (sessionId != null) {
            candidatures = candidatureRepository.findBySessionIdOrderBySubmittedAtDesc(sessionId);
        } else if (status != null) {
            candidatures = candidatureRepository.findByStatusOrderBySubmittedAtDesc(status);
        } else {
            candidatures = candidatureRepository.findAllByOrderBySubmittedAtDesc();
        }
        return candidatures.stream().map(c -> {
            List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toEvaluationDto).collect(Collectors.toList());
            List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
            return toDto(c, evals, assignments);
        }).collect(Collectors.toList());
    }

    public List<CandidatureDto> getMyCandidatures(Long porteurId) {
        return candidatureRepository.findByPorteurId(porteurId).stream().map(c -> {
            List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toEvaluationDto).collect(Collectors.toList());
            List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
            return toDto(c, evals, assignments);
        }).collect(Collectors.toList());
    }

    public CandidatureDto getCandidatureById(Long id) {
        Candidature candidature = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(id)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(id)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignments);
    }

    public List<CandidatureDto> getMyJuryAssignments(Long juryId) {
        List<JuryAssignment> assignments = juryAssignmentRepository.findByJuryId(juryId);
        return assignments.stream().map(a -> {
            Candidature c = candidatureRepository.findById(a.getCandidatureId())
                    .orElseThrow(() -> new RuntimeException("Candidature not found"));
            List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toEvaluationDto).collect(Collectors.toList());
            List<JuryAssignmentDto> assignmentDtos = juryAssignmentRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
            return toDto(c, evals, assignmentDtos);
        }).collect(Collectors.toList());
    }

    public List<CandidatureDto> getCandidaturesBySession(Long sessionId) {
        return candidatureRepository.findBySessionIdOrderBySubmittedAtDesc(sessionId).stream().map(c -> {
            List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toEvaluationDto).collect(Collectors.toList());
            List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(c.getId())
                    .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
            return toDto(c, evals, assignments);
        }).collect(Collectors.toList());
    }

    @Transactional
    public CandidatureDto assignJury(Long candidatureId, AssignJuryRequest request) {
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));

        // Remove existing assignments and add new ones
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

        // Change status to UNDER_EVALUATION
        candidature.setStatus(CandidatureStatus.UNDER_EVALUATION);
        candidatureRepository.save(candidature);

        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignmentDtos = assignments.stream()
                .map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignmentDtos);
    }

    @Transactional
    public CandidatureDto evaluateCandidature(Long candidatureId, Long juryId, EvaluationRequest request) {
        Candidature candidature = candidatureRepository.findById(candidatureId)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));

        // Check if jury already evaluated - if so, update; otherwise create
        Evaluation evaluation = evaluationRepository.findByCandidatureIdAndJuryId(candidatureId, juryId)
                .orElse(Evaluation.builder()
                        .candidatureId(candidatureId)
                        .juryId(juryId)
                        .build());

        evaluation.setJuryEmail(request.getJuryEmail());
        evaluation.setJuryName(request.getJuryName());
        evaluation.setInnovationScore(request.getInnovationScore());
        evaluation.setFeasibilityScore(request.getFeasibilityScore());
        evaluation.setMarketImpactScore(request.getMarketImpactScore());
        evaluation.setTeamQualityScore(request.getTeamQualityScore());
        evaluation.setComment(request.getComment());
        evaluation.calculateWeightedScore();

        evaluationRepository.save(evaluation);

        // Recalculate total score as average of all weighted scores
        List<Evaluation> allEvals = evaluationRepository.findByCandidatureId(candidatureId);
        OptionalDouble avg = allEvals.stream()
                .filter(e -> e.getWeightedScore() != null)
                .mapToDouble(Evaluation::getWeightedScore)
                .average();
        if (avg.isPresent()) {
            candidature.setTotalScore(avg.getAsDouble());
            candidatureRepository.save(candidature);
        }

        List<EvaluationDto> evals = allEvals.stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(candidatureId)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignments);
    }

    @Transactional
    public CandidatureDto acceptCandidature(Long id, Long adminId) {
        Candidature candidature = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        candidature.setStatus(CandidatureStatus.ACCEPTED);
        candidatureRepository.save(candidature);

        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(id)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(id)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignments);
    }

    @Transactional
    public CandidatureDto rejectCandidature(Long id, String reason, Long adminId) {
        Candidature candidature = candidatureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidature not found"));
        candidature.setStatus(CandidatureStatus.REJECTED);
        candidature.setRejectionReason(reason);
        candidatureRepository.save(candidature);

        List<EvaluationDto> evals = evaluationRepository.findByCandidatureId(id)
                .stream().map(this::toEvaluationDto).collect(Collectors.toList());
        List<JuryAssignmentDto> assignments = juryAssignmentRepository.findByCandidatureId(id)
                .stream().map(this::toJuryAssignmentDto).collect(Collectors.toList());
        return toDto(candidature, evals, assignments);
    }

    public Map<String, Long> getStats() {
        return Map.of(
                "total", candidatureRepository.count(),
                "pending", candidatureRepository.countByStatus(CandidatureStatus.PENDING),
                "underEvaluation", candidatureRepository.countByStatus(CandidatureStatus.UNDER_EVALUATION),
                "accepted", candidatureRepository.countByStatus(CandidatureStatus.ACCEPTED),
                "rejected", candidatureRepository.countByStatus(CandidatureStatus.REJECTED)
        );
    }

    private CandidatureDto toDto(Candidature c, List<EvaluationDto> evals, List<JuryAssignmentDto> assignments) {
        return CandidatureDto.builder()
                .id(c.getId())
                .sessionId(c.getSessionId())
                .porteurId(c.getPorteurId())
                .porteurEmail(c.getPorteurEmail())
                .porteurName(c.getPorteurName())
                .projectName(c.getProjectName())
                .projectDescription(c.getProjectDescription())
                .domain(c.getDomain())
                .targetMarket(c.getTargetMarket())
                .currentStage(c.getCurrentStage())
                .teamSize(c.getTeamSize())
                .techStack(c.getTechStack())
                .problemStatement(c.getProblemStatement())
                .solutionDescription(c.getSolutionDescription())
                .businessModel(c.getBusinessModel())
                .teamBackground(c.getTeamBackground())
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
        return EvaluationDto.builder()
                .id(e.getId())
                .candidatureId(e.getCandidatureId())
                .juryId(e.getJuryId())
                .juryEmail(e.getJuryEmail())
                .juryName(e.getJuryName())
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
