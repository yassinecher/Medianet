package com.medianet.programme.controller;

import com.medianet.programme.entity.*;
import com.medianet.programme.repository.ProgrammePhaseRepository;
import com.medianet.programme.repository.ProgrammeRepository;
import com.medianet.programme.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregated programme/session/task statistics for the back-office Reports
 * module. Gated by the ADMIN-scoped {@code reports:read} permission.
 */
@RestController
@RequestMapping("/api/programmes/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ProgrammeRepository      programmeRepository;
    private final ProgrammePhaseRepository phaseRepository;
    private final TaskRepository           taskRepository;

    /** Programme-scoped sessions/tasks report (drives the programme's Rapports tab). */
    @GetMapping("/{programmeId}")
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> programmeReport(@PathVariable Long programmeId) {
        List<ProgrammePhase> sessions = phaseRepository.findAll().stream()
                .filter(s -> s.getProgramme() != null && programmeId.equals(s.getProgramme().getId()))
                .toList();
        List<Task> tasks = taskRepository.findAll().stream()
                .filter(t -> programmeId.equals(t.getProgrammeId())).toList();
        LocalDate today = LocalDate.now();

        Map<String, Long> sessionsByStatus = new LinkedHashMap<>();
        for (PhaseStatus s : PhaseStatus.values()) sessionsByStatus.put(s.name(), 0L);
        for (ProgrammePhase s : sessions) {
            if (s.getStatus() != null) sessionsByStatus.merge(s.getStatus().name(), 1L, Long::sum);
        }

        Map<String, Long> tasksByStatus = new LinkedHashMap<>();
        for (TaskStatus s : TaskStatus.values()) tasksByStatus.put(s.name(), 0L);
        for (Task t : tasks) {
            if (t.getStatus() != null) tasksByStatus.merge(t.getStatus().name(), 1L, Long::sum);
        }
        long overdueTasks = tasks.stream().filter(t ->
                t.getDueDate() != null && t.getDueDate().isBefore(today)
                        && t.getStatus() != TaskStatus.COMPLETED
                        && t.getStatus() != TaskStatus.CANCELLED).count();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("programmeId", programmeId);
        out.put("totalSessions", sessions.size());
        out.put("sessionsByStatus", sessionsByStatus);
        out.put("upcomingSessions", sessions.stream()
                .filter(s -> s.getStartDate() != null && s.getStartDate().isAfter(today)).count());
        out.put("totalTasks", tasks.size());
        out.put("tasksByStatus", tasksByStatus);
        out.put("overdueTasks", overdueTasks);
        return ResponseEntity.ok(out);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> programmesReport() {
        List<Programme> programmes = programmeRepository.findAll();
        List<ProgrammePhase> sessions = phaseRepository.findAll();
        List<Task> tasks = taskRepository.findAll();
        LocalDate today = LocalDate.now();

        Map<String, Long> programmesByStatus = new LinkedHashMap<>();
        for (ProgrammeStatus s : ProgrammeStatus.values()) programmesByStatus.put(s.name(), 0L);
        for (Programme p : programmes) {
            if (p.getStatus() != null) programmesByStatus.merge(p.getStatus().name(), 1L, Long::sum);
        }

        Map<String, Long> sessionsByStatus = new LinkedHashMap<>();
        for (PhaseStatus s : PhaseStatus.values()) sessionsByStatus.put(s.name(), 0L);
        for (ProgrammePhase s : sessions) {
            if (s.getStatus() != null) sessionsByStatus.merge(s.getStatus().name(), 1L, Long::sum);
        }
        long upcomingSessions = sessions.stream()
                .filter(s -> s.getStartDate() != null && s.getStartDate().isAfter(today)).count();

        Map<String, Long> tasksByStatus = new LinkedHashMap<>();
        for (TaskStatus s : TaskStatus.values()) tasksByStatus.put(s.name(), 0L);
        for (Task t : tasks) {
            if (t.getStatus() != null) tasksByStatus.merge(t.getStatus().name(), 1L, Long::sum);
        }
        Map<String, Long> tasksByPriority = new LinkedHashMap<>();
        for (TaskPriority p : TaskPriority.values()) tasksByPriority.put(p.name(), 0L);
        for (Task t : tasks) {
            if (t.getPriority() != null) tasksByPriority.merge(t.getPriority().name(), 1L, Long::sum);
        }
        long overdueTasks = tasks.stream().filter(t ->
                t.getDueDate() != null && t.getDueDate().isBefore(today)
                        && t.getStatus() != TaskStatus.COMPLETED
                        && t.getStatus() != TaskStatus.CANCELLED).count();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalProgrammes", programmes.size());
        out.put("programmesByStatus", programmesByStatus);
        out.put("totalSessions", sessions.size());
        out.put("sessionsByStatus", sessionsByStatus);
        out.put("upcomingSessions", upcomingSessions);
        out.put("totalTasks", tasks.size());
        out.put("tasksByStatus", tasksByStatus);
        out.put("tasksByPriority", tasksByPriority);
        out.put("overdueTasks", overdueTasks);
        // id → title map so other reports (candidatures) can label programmes.
        Map<String, String> programmeTitles = new LinkedHashMap<>();
        for (Programme p : programmes) programmeTitles.put(String.valueOf(p.getId()), p.getTitle());
        out.put("programmeTitles", programmeTitles);
        return ResponseEntity.ok(out);
    }
}
