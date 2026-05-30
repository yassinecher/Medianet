package com.medianet.programme.service;

import com.medianet.programme.dto.*;
import com.medianet.programme.entity.*;
import com.medianet.programme.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgrammeServiceTest {

    @Mock private ProgrammeRepository         programmeRepository;
    @Mock private ProgrammeCriteriaRepository criteriaRepository;
    @Mock private ProgrammePhaseRepository    phaseRepository;

    @InjectMocks
    private ProgrammeService service;

    private Programme baseProgramme;

    @BeforeEach
    void setUp() {
        baseProgramme = Programme.builder()
                .id(1L)
                .title("Startup Challenge 2025")
                .description("Incubation programme for tech startups")
                .type(ProgrammeType.PUBLIC)
                .status(ProgrammeStatus.DRAFT)
                .maxApplications(50)
                .createdByAdminId(1L)
                .createdByAdminName("Admin")
                .build();
    }

    // ── createProgramme ───────────────────────────────────────────────────────

    @Test
    void create_validRequest_savesAndReturnsDto() {
        CreateProgrammeRequest req = new CreateProgrammeRequest();
        req.setTitle("Startup Challenge 2025");
        req.setDescription("Incubation programme for tech startups");
        req.setType("PUBLIC");
        req.setMaxApplications(50);

        when(programmeRepository.save(any())).thenAnswer(inv -> {
            Programme p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.createProgramme(req, 1L, "Admin");

        assertThat(dto.getTitle()).isEqualTo("Startup Challenge 2025");
        assertThat(dto.getStatus()).isEqualTo("DRAFT");
        verify(programmeRepository).save(any(Programme.class));
    }

    @Test
    void create_withDeadline_persistsDeadline() {
        CreateProgrammeRequest req = new CreateProgrammeRequest();
        req.setTitle("Programme with deadline");
        req.setType("PRIVATE");
        req.setApplicationDeadline(LocalDate.of(2025, 6, 30));

        when(programmeRepository.save(any())).thenAnswer(inv -> {
            Programme p = inv.getArgument(0);
            p.setId(2L);
            return p;
        });
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(2L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(2L)).thenReturn(List.of());

        ProgrammeDto dto = service.createProgramme(req, 1L, "Admin");
        assertThat(dto.getApplicationDeadline()).isEqualTo(LocalDate.of(2025, 6, 30));
    }

    // ── getAllProgrammes ───────────────────────────────────────────────────────

    @Test
    void getAll_noFilters_returnsAll() {
        when(programmeRepository.findAll()).thenReturn(List.of(baseProgramme));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        List<ProgrammeDto> list = service.getAllProgrammes(null, null);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getTitle()).isEqualTo("Startup Challenge 2025");
    }

    @Test
    void getAll_withStatusFilter_delegatesToRepository() {
        when(programmeRepository.findByStatus(ProgrammeStatus.OPEN)).thenReturn(List.of());

        List<ProgrammeDto> list = service.getAllProgrammes("OPEN", null);
        assertThat(list).isEmpty();
        verify(programmeRepository).findByStatus(ProgrammeStatus.OPEN);
    }

    @Test
    void getAll_withTypeFilter_delegatesToRepository() {
        when(programmeRepository.findByType(ProgrammeType.PRIVATE)).thenReturn(List.of());

        List<ProgrammeDto> list = service.getAllProgrammes(null, "PRIVATE");
        assertThat(list).isEmpty();
        verify(programmeRepository).findByType(ProgrammeType.PRIVATE);
    }

    @Test
    void getAll_withBothFilters_usesCombinedQuery() {
        when(programmeRepository.findByTypeAndStatus(ProgrammeType.PUBLIC, ProgrammeStatus.OPEN))
                .thenReturn(List.of(baseProgramme));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        List<ProgrammeDto> list = service.getAllProgrammes("OPEN", "PUBLIC");
        assertThat(list).hasSize(1);
        verify(programmeRepository).findByTypeAndStatus(ProgrammeType.PUBLIC, ProgrammeStatus.OPEN);
    }

    // ── getProgrammeById ──────────────────────────────────────────────────────

    @Test
    void getById_existingId_returnsDto() {
        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.getProgrammeById(1L);
        assertThat(dto.getId()).isEqualTo(1L);
    }

    @Test
    void getById_missingId_throwsException() {
        when(programmeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getProgrammeById(99L))
                .isInstanceOf(RuntimeException.class);
    }

    // ── updateProgramme ───────────────────────────────────────────────────────

    @Test
    void update_titleOnly_onlyUpdatesTitleAndPreservesOthers() {
        UpdateProgrammeRequest req = new UpdateProgrammeRequest();
        req.setTitle("Updated Title");

        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(programmeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.updateProgramme(1L, req);
        assertThat(dto.getTitle()).isEqualTo("Updated Title");
        assertThat(dto.getDescription()).isEqualTo("Incubation programme for tech startups"); // unchanged
    }

    @Test
    void update_maxApplications_updatesField() {
        UpdateProgrammeRequest req = new UpdateProgrammeRequest();
        req.setMaxApplications(100);

        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(programmeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.updateProgramme(1L, req);
        assertThat(dto.getMaxApplications()).isEqualTo(100);
    }

    // ── updateStatus ──────────────────────────────────────────────────────────

    @Test
    void updateStatus_draft_to_open_succeeds() {
        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(programmeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.updateStatus(1L, "OPEN");
        assertThat(dto.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void updateStatus_open_to_closed_succeeds() {
        baseProgramme.setStatus(ProgrammeStatus.OPEN);
        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(programmeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L)).thenReturn(List.of());
        when(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(1L)).thenReturn(List.of());

        ProgrammeDto dto = service.updateStatus(1L, "CLOSED");
        assertThat(dto.getStatus()).isEqualTo("CLOSED");
    }

    // ── addCriterion ──────────────────────────────────────────────────────────

    @Test
    void addCriterion_validRequest_savesAndReturnsCriteriaDto() {
        CreateCriteriaRequest req = new CreateCriteriaRequest();
        req.setName("Innovation");
        req.setWeight(0.30);
        req.setCriterionOrder(1);

        ProgrammeCriteria saved = ProgrammeCriteria.builder()
                .id(10L)
                .programme(baseProgramme)
                .name("Innovation")
                .weight(0.30)
                .criterionOrder(1)
                .active(true)
                .build();

        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(criteriaRepository.save(any())).thenReturn(saved);

        ProgrammeCriteriaDto dto = service.addCriterion(1L, req);
        assertThat(dto.getName()).isEqualTo("Innovation");
        assertThat(dto.getWeight()).isEqualTo(0.30);
    }

    @Test
    void addCriterion_nullWeight_defaultsToZero() {
        CreateCriteriaRequest req = new CreateCriteriaRequest();
        req.setName("Faisabilité");
        req.setWeight(null); // should default to 0.0

        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(criteriaRepository.save(any())).thenAnswer(inv -> {
            ProgrammeCriteria c = inv.getArgument(0);
            c.setId(11L);
            return c;
        });

        ProgrammeCriteriaDto dto = service.addCriterion(1L, req);
        assertThat(dto.getWeight()).isEqualTo(0.0);
    }

    // ── getCriteria ───────────────────────────────────────────────────────────

    @Test
    void getCriteria_returnsSortedList() {
        ProgrammeCriteria c1 = ProgrammeCriteria.builder().id(1L).programme(baseProgramme)
                .name("Innovation").weight(0.30).criterionOrder(1).active(true).build();
        ProgrammeCriteria c2 = ProgrammeCriteria.builder().id(2L).programme(baseProgramme)
                .name("Faisabilité").weight(0.25).criterionOrder(2).active(true).build();

        when(programmeRepository.findById(1L)).thenReturn(Optional.of(baseProgramme));
        when(criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(1L))
                .thenReturn(List.of(c1, c2));

        List<ProgrammeCriteriaDto> list = service.getCriteria(1L);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).getName()).isEqualTo("Innovation");
        assertThat(list.get(1).getName()).isEqualTo("Faisabilité");
    }

    // ── deleteCriterion ───────────────────────────────────────────────────────

    @Test
    void deleteCriterion_existingId_callsDeleteById() {
        ProgrammeCriteria criterion = ProgrammeCriteria.builder()
                .id(10L).programme(baseProgramme).name("Test").weight(0.1).build();

        when(criteriaRepository.findById(10L)).thenReturn(Optional.of(criterion));

        service.deleteCriterion(1L, 10L);
        verify(criteriaRepository).deleteById(10L);
    }

    @Test
    void deleteCriterion_wrongProgrammeId_throwsException() {
        Programme otherProgramme = Programme.builder().id(99L).build();
        ProgrammeCriteria criterion = ProgrammeCriteria.builder()
                .id(10L).programme(otherProgramme).name("Test").weight(0.1).build();

        when(criteriaRepository.findById(10L)).thenReturn(Optional.of(criterion));

        assertThatThrownBy(() -> service.deleteCriterion(1L, 10L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── getStats ──────────────────────────────────────────────────────────────

    @Test
    void getStats_returnsAllStatusCounts() {
        for (ProgrammeStatus s : ProgrammeStatus.values()) {
            when(programmeRepository.countByStatus(s)).thenReturn(1L);
        }

        Map<String, Long> stats = service.getStats();
        assertThat(stats).containsKey("DRAFT");
        assertThat(stats).containsKey("OPEN");
        assertThat(stats).containsKey("CLOSED");
        assertThat(stats).containsKey("ARCHIVED");
    }
}
