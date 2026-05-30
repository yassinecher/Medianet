package com.medianet.candidature.service;

import com.medianet.candidature.dto.*;
import com.medianet.candidature.entity.*;
import com.medianet.candidature.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CandidatureServiceTest {

    @Mock private CandidatureRepository    candidatureRepository;
    @Mock private EvaluationRepository     evaluationRepository;
    @Mock private JuryAssignmentRepository juryAssignmentRepository;

    @InjectMocks
    private CandidatureService service;

    private Candidature baseCandidature;

    @BeforeEach
    void setUp() {
        baseCandidature = Candidature.builder()
                .id(1L)
                .porteurId(10L)
                .porteurEmail("porteur@test.com")
                .porteurName("Alice Martin")
                .programmeId(5L)
                .projectName("GreenTech DZ")
                .projectDescription("Solar energy startup")
                .domain("CleanTech")
                .teamSize(4)
                .status(CandidatureStatus.PENDING)
                .build();
    }

    // ── submitCandidature ─────────────────────────────────────────────────────

    @Test
    void submit_newCandidature_savesAndReturnsDto() {
        SubmitCandidatureRequest req = new SubmitCandidatureRequest();
        req.setProgrammeId(5L);
        req.setProjectName("GreenTech DZ");
        req.setProjectDescription("Solar energy startup");
        req.setDomain("CleanTech");
        req.setTeamSize(4);

        when(candidatureRepository.findByPorteurIdAndProgrammeId(10L, 5L)).thenReturn(Optional.empty());
        when(candidatureRepository.save(any())).thenAnswer(inv -> {
            Candidature c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.submitCandidature(req, 10L, "porteur@test.com", "Alice Martin");

        assertThat(dto.getProjectName()).isEqualTo("GreenTech DZ");
        assertThat(dto.getStatus()).isEqualTo("PENDING");
        assertThat(dto.getPorteurId()).isEqualTo(10L);
        verify(candidatureRepository).save(any(Candidature.class));
    }

    @Test
    void submit_duplicateProgramme_throwsIllegalState() {
        SubmitCandidatureRequest req = new SubmitCandidatureRequest();
        req.setProgrammeId(5L);

        when(candidatureRepository.findByPorteurIdAndProgrammeId(10L, 5L))
                .thenReturn(Optional.of(baseCandidature));

        assertThatThrownBy(() -> service.submitCandidature(req, 10L, "porteur@test.com", "Alice"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already submitted");
    }

    // ── getCandidatureById ────────────────────────────────────────────────────

    @Test
    void getById_existingId_returnsDto() {
        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.getCandidatureById(1L);
        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getProjectName()).isEqualTo("GreenTech DZ");
    }

    @Test
    void getById_missingId_throwsRuntimeException() {
        when(candidatureRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCandidatureById(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found");
    }

    // ── getMyCandidatures ─────────────────────────────────────────────────────

    @Test
    void getMyCandidatures_returnsOnlyPorteurCandidatures() {
        when(candidatureRepository.findByPorteurId(10L)).thenReturn(List.of(baseCandidature));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        List<CandidatureDto> list = service.getMyCandidatures(10L);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getPorteurId()).isEqualTo(10L);
    }

    @Test
    void getMyCandidatures_noCandidatures_returnsEmptyList() {
        when(candidatureRepository.findByPorteurId(99L)).thenReturn(List.of());

        List<CandidatureDto> list = service.getMyCandidatures(99L);
        assertThat(list).isEmpty();
    }

    // ── acceptCandidature ─────────────────────────────────────────────────────

    @Test
    void accept_pendingCandidature_setsStatusAccepted() {
        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(candidatureRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.acceptCandidature(1L, 1L);
        assertThat(dto.getStatus()).isEqualTo("ACCEPTED");
    }

    @Test
    void accept_nonExistentId_throwsRuntimeException() {
        when(candidatureRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.acceptCandidature(999L, 1L))
                .isInstanceOf(RuntimeException.class);
    }

    // ── rejectCandidature ─────────────────────────────────────────────────────

    @Test
    void reject_setsStatusRejectedAndReason() {
        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(candidatureRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.rejectCandidature(1L, "Does not meet criteria", 1L);
        assertThat(dto.getStatus()).isEqualTo("REJECTED");
        assertThat(dto.getRejectionReason()).isEqualTo("Does not meet criteria");
    }

    // ── assignJury ────────────────────────────────────────────────────────────

    @Test
    void assignJury_replacesExistingAssignments() {
        AssignJuryRequest req = new AssignJuryRequest();
        JuryAssignmentItem item = new JuryAssignmentItem();
        item.setJuryId(20L);
        item.setJuryEmail("jury@test.com");
        item.setJuryName("Judge Dredd");
        req.setJuryAssignments(List.of(item));

        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(candidatureRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(juryAssignmentRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.assignJury(1L, req);
        assertThat(dto.getStatus()).isEqualTo("UNDER_EVALUATION");
        verify(juryAssignmentRepository).deleteByCandidatureId(1L);
        verify(juryAssignmentRepository).saveAll(any());
    }

    // ── evaluateCandidature (legacy mode) ─────────────────────────────────────

    @Test
    void evaluate_legacyMode_computesWeightedScore() {
        EvaluationRequest req = new EvaluationRequest();
        req.setJuryEmail("jury@test.com");
        req.setJuryName("Judge");
        req.setInnovationScore(8);
        req.setFeasibilityScore(7);
        req.setMarketImpactScore(9);
        req.setTeamQualityScore(8);
        req.setComment("Excellent project");
        req.setCriteriaScores(List.of()); // empty = legacy mode

        Evaluation savedEval = Evaluation.builder()
                .id(1L)
                .candidatureId(1L)
                .juryId(20L)
                .innovationScore(8)
                .feasibilityScore(7)
                .marketImpactScore(9)
                .teamQualityScore(8)
                .weightedScore(8.05)  // 0.3*8 + 0.25*7 + 0.25*9 + 0.2*8
                .criteriaScores(List.of())
                .build();

        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(evaluationRepository.findByCandidatureIdAndJuryId(1L, 20L)).thenReturn(Optional.empty());
        when(evaluationRepository.save(any())).thenReturn(savedEval);
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of(savedEval));
        when(candidatureRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        CandidatureDto dto = service.evaluateCandidature(1L, 20L, req);
        assertThat(dto.getEvaluations()).hasSize(1);
        assertThat(dto.getEvaluations().get(0).getWeightedScore()).isEqualTo(8.05);
    }

    @Test
    void evaluate_existingEvaluation_updatesInsteadOfCreating() {
        Evaluation existingEval = Evaluation.builder()
                .id(5L)
                .candidatureId(1L)
                .juryId(20L)
                .innovationScore(5)
                .feasibilityScore(5)
                .marketImpactScore(5)
                .teamQualityScore(5)
                .criteriaScores(new ArrayList<>())
                .build();

        EvaluationRequest req = new EvaluationRequest();
        req.setInnovationScore(9);
        req.setFeasibilityScore(9);
        req.setMarketImpactScore(9);
        req.setTeamQualityScore(9);
        req.setCriteriaScores(List.of());

        when(candidatureRepository.findById(1L)).thenReturn(Optional.of(baseCandidature));
        when(evaluationRepository.findByCandidatureIdAndJuryId(1L, 20L)).thenReturn(Optional.of(existingEval));
        when(evaluationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of(existingEval));
        when(candidatureRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        service.evaluateCandidature(1L, 20L, req);
        // save should be called exactly once (update, not create)
        verify(evaluationRepository, times(1)).save(existingEval);
    }

    // ── getStats ──────────────────────────────────────────────────────────────

    @Test
    void getStats_returnsCorrectCounts() {
        when(candidatureRepository.count()).thenReturn(10L);
        when(candidatureRepository.countByStatus(CandidatureStatus.PENDING)).thenReturn(4L);
        when(candidatureRepository.countByStatus(CandidatureStatus.UNDER_EVALUATION)).thenReturn(3L);
        when(candidatureRepository.countByStatus(CandidatureStatus.ACCEPTED)).thenReturn(2L);
        when(candidatureRepository.countByStatus(CandidatureStatus.REJECTED)).thenReturn(1L);

        Map<String, Long> stats = service.getStats();
        assertThat(stats.get("total")).isEqualTo(10L);
        assertThat(stats.get("pending")).isEqualTo(4L);
        assertThat(stats.get("accepted")).isEqualTo(2L);
        assertThat(stats.get("rejected")).isEqualTo(1L);
    }

    @Test
    void getProgrammeStats_filtersByProgrammeId() {
        when(candidatureRepository.countByProgrammeId(5L)).thenReturn(3L);
        when(candidatureRepository.countByProgrammeIdAndStatus(5L, CandidatureStatus.PENDING)).thenReturn(1L);
        when(candidatureRepository.countByProgrammeIdAndStatus(5L, CandidatureStatus.UNDER_EVALUATION)).thenReturn(1L);
        when(candidatureRepository.countByProgrammeIdAndStatus(5L, CandidatureStatus.ACCEPTED)).thenReturn(1L);
        when(candidatureRepository.countByProgrammeIdAndStatus(5L, CandidatureStatus.REJECTED)).thenReturn(0L);

        Map<String, Long> stats = service.getProgrammeStats(5L);
        assertThat(stats.get("total")).isEqualTo(3L);
        assertThat(stats.get("pending")).isEqualTo(1L);
    }

    // ── getAllCandidatures (filter combinations) ───────────────────────────────

    @Test
    void getAll_noFilters_returnsAll() {
        when(candidatureRepository.findAllByOrderBySubmittedAtDesc()).thenReturn(List.of(baseCandidature));
        when(evaluationRepository.findByCandidatureId(1L)).thenReturn(List.of());
        when(juryAssignmentRepository.findByCandidatureId(1L)).thenReturn(List.of());

        List<CandidatureDto> list = service.getAllCandidatures(null);
        assertThat(list).hasSize(1);
    }

    @Test
    void getAll_withStatusFilter_delegatesToRepository() {
        when(candidatureRepository.findByStatusOrderBySubmittedAtDesc(CandidatureStatus.ACCEPTED))
                .thenReturn(List.of());

        List<CandidatureDto> list = service.getAllCandidatures(CandidatureStatus.ACCEPTED);
        assertThat(list).isEmpty();
        verify(candidatureRepository).findByStatusOrderBySubmittedAtDesc(CandidatureStatus.ACCEPTED);
    }
}
