package com.medianet.candidature.controller;

import com.medianet.candidature.entity.Candidature;
import com.medianet.candidature.entity.CandidatureStatus;
import com.medianet.candidature.entity.Evaluation;
import com.medianet.candidature.repository.CandidatureRepository;
import com.medianet.candidature.repository.EvaluationRepository;
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
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregated candidature/evaluation statistics for the back-office Reports
 * module. Gated by the ADMIN-scoped {@code reports:read} permission.
 */
@RestController
@RequestMapping("/api/candidatures/reports")
@RequiredArgsConstructor
public class ReportController {

    private final CandidatureRepository candidatureRepository;
    private final EvaluationRepository  evaluationRepository;

    /** Programme-scoped candidature report (drives the programme's Rapports tab). */
    @GetMapping("/programme/{programmeId}")
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> programmeReport(@PathVariable Long programmeId) {
        List<Candidature> all = candidatureRepository.findAll().stream()
                .filter(c -> programmeId.equals(c.getProgrammeId())).toList();
        Set<Long> candIds = all.stream().map(Candidature::getId).collect(Collectors.toSet());
        List<Evaluation> evaluations = evaluationRepository.findAll().stream()
                .filter(e -> candIds.contains(e.getCandidatureId())).toList();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (CandidatureStatus s : CandidatureStatus.values()) byStatus.put(s.name(), 0L);
        for (Candidature c : all) {
            if (c.getStatus() != null) byStatus.merge(c.getStatus().name(), 1L, Long::sum);
        }

        Map<String, Long> byMonth = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(LocalDate.now()).minusMonths(11);
        for (int i = 0; i < 12; i++) { byMonth.put(cursor.toString(), 0L); cursor = cursor.plusMonths(1); }
        for (Candidature c : all) {
            if (c.getSubmittedAt() == null) continue;
            byMonth.computeIfPresent(YearMonth.from(c.getSubmittedAt()).toString(), (k, v) -> v + 1);
        }

        Map<String, Long> bySector = all.stream().collect(Collectors.groupingBy(
                c -> (c.getSector() == null || c.getSector().isBlank()) ? "Autre" : c.getSector(),
                Collectors.counting()));

        Map<Long, Double> avgByCand = evaluations.stream()
                .filter(e -> e.getWeightedScore() != null)
                .collect(Collectors.groupingBy(Evaluation::getCandidatureId,
                        Collectors.averagingDouble(Evaluation::getWeightedScore)));
        OptionalDouble avg = avgByCand.values().stream().mapToDouble(Double::doubleValue).average();

        long accepted = byStatus.getOrDefault("ACCEPTED", 0L);
        long decided  = accepted + byStatus.getOrDefault("REJECTED", 0L);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("programmeId", programmeId);
        out.put("total", all.size());
        out.put("byStatus", byStatus);
        out.put("byMonth", byMonth);
        out.put("bySector", bySector);
        out.put("acceptanceRate", decided == 0 ? null : Math.round(accepted * 1000.0 / decided) / 10.0);
        out.put("evaluationsTotal", evaluations.size());
        out.put("evaluatedCandidatures", avgByCand.size());
        out.put("averageScore", avg.isPresent() ? Math.round(avg.getAsDouble() * 100) / 100.0 : null);
        return ResponseEntity.ok(out);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('reports:read')")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> candidaturesReport() {
        List<Candidature> all = candidatureRepository.findAll();
        List<Evaluation> evaluations = evaluationRepository.findAll();

        // Status distribution (all enum values present, even at 0).
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (CandidatureStatus s : CandidatureStatus.values()) byStatus.put(s.name(), 0L);
        for (Candidature c : all) {
            if (c.getStatus() != null) byStatus.merge(c.getStatus().name(), 1L, Long::sum);
        }

        // Submissions per month, last 12 months (oldest first).
        Map<String, Long> byMonth = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(LocalDate.now()).minusMonths(11);
        for (int i = 0; i < 12; i++) { byMonth.put(cursor.toString(), 0L); cursor = cursor.plusMonths(1); }
        for (Candidature c : all) {
            if (c.getSubmittedAt() == null) continue;
            byMonth.computeIfPresent(YearMonth.from(c.getSubmittedAt()).toString(), (k, v) -> v + 1);
        }

        // Top sectors (unknown/empty grouped as "Autre").
        Map<String, Long> bySector = all.stream().collect(Collectors.groupingBy(
                c -> (c.getSector() == null || c.getSector().isBlank()) ? "Autre" : c.getSector(),
                Collectors.counting()));
        Map<String, Long> topSectors = bySector.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(8)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new));

        // Average weighted score per candidature (only evaluated ones).
        Map<Long, Double> avgScoreByCandidature = evaluations.stream()
                .filter(e -> e.getWeightedScore() != null)
                .collect(Collectors.groupingBy(Evaluation::getCandidatureId,
                        Collectors.averagingDouble(Evaluation::getWeightedScore)));

        // Per-programme breakdown (names are joined client-side from /api/programmes).
        Map<Long, List<Candidature>> byProgramme = all.stream()
                .filter(c -> c.getProgrammeId() != null)
                .collect(Collectors.groupingBy(Candidature::getProgrammeId));
        List<Map<String, Object>> perProgramme = new ArrayList<>();
        for (Map.Entry<Long, List<Candidature>> e : byProgramme.entrySet()) {
            List<Candidature> list = e.getValue();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("programmeId", e.getKey());
            row.put("total", list.size());
            for (CandidatureStatus s : CandidatureStatus.values()) {
                row.put(s.name().toLowerCase(),
                        list.stream().filter(c -> c.getStatus() == s).count());
            }
            OptionalDouble avg = list.stream()
                    .map(c -> avgScoreByCandidature.get(c.getId()))
                    .filter(Objects::nonNull)
                    .mapToDouble(Double::doubleValue).average();
            row.put("averageScore", avg.isPresent() ? Math.round(avg.getAsDouble() * 100) / 100.0 : null);
            perProgramme.add(row);
        }
        perProgramme.sort((a, b) -> Long.compare((int) b.get("total"), (int) a.get("total")));

        long accepted = byStatus.getOrDefault("ACCEPTED", 0L);
        long decided  = accepted + byStatus.getOrDefault("REJECTED", 0L);
        OptionalDouble overallAvg = avgScoreByCandidature.values().stream()
                .mapToDouble(Double::doubleValue).average();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", all.size());
        out.put("byStatus", byStatus);
        out.put("byMonth", byMonth);
        out.put("topSectors", topSectors);
        out.put("perProgramme", perProgramme);
        out.put("acceptanceRate", decided == 0 ? null : Math.round(accepted * 1000.0 / decided) / 10.0);
        out.put("evaluationsTotal", evaluations.size());
        out.put("evaluatedCandidatures", avgScoreByCandidature.size());
        out.put("averageScore", overallAvg.isPresent() ? Math.round(overallAvg.getAsDouble() * 100) / 100.0 : null);
        return ResponseEntity.ok(out);
    }
}
