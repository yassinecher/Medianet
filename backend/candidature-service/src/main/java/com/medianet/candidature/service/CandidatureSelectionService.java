package com.medianet.candidature.service;

import com.medianet.candidature.dto.CandidatureSelectionDto;
import com.medianet.candidature.dto.SelectionRequest;
import com.medianet.candidature.entity.CandidatureSelection;
import com.medianet.candidature.repository.CandidatureSelectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/** Named, ordered candidature shortlists (versions) per programme. */
@Service
@RequiredArgsConstructor
public class CandidatureSelectionService {

    private final CandidatureSelectionRepository repo;

    @Transactional(readOnly = true)
    public List<CandidatureSelectionDto> list(Long programmeId) {
        return repo.findByProgrammeIdOrderByCreatedAtDesc(programmeId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public CandidatureSelectionDto create(Long programmeId, SelectionRequest req) {
        CandidatureSelection s = CandidatureSelection.builder()
                .programmeId(programmeId)
                .name(req.getName().trim())
                .candidatureIds(toCsv(req.getCandidatureIds()))
                .build();
        return toDto(repo.save(s));
    }

    @Transactional
    public CandidatureSelectionDto update(Long id, SelectionRequest req) {
        CandidatureSelection s = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sélection introuvable : " + id));
        if (req.getName() != null && !req.getName().isBlank()) s.setName(req.getName().trim());
        if (req.getCandidatureIds() != null) s.setCandidatureIds(toCsv(req.getCandidatureIds()));
        return toDto(repo.save(s));
    }

    @Transactional
    public void delete(Long id) {
        repo.deleteById(id);
    }

    // ── CSV ⇄ List<Long> ────────────────────────────────────────────────────────
    private String toCsv(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "";
        return ids.stream().filter(Objects::nonNull).map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> fromCsv(String csv) {
        List<Long> out = new ArrayList<>();
        if (csv == null || csv.isBlank()) return out;
        for (String part : csv.split(",")) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            try { out.add(Long.parseLong(p)); } catch (NumberFormatException ignored) { /* skip */ }
        }
        return out;
    }

    private CandidatureSelectionDto toDto(CandidatureSelection s) {
        return CandidatureSelectionDto.builder()
                .id(s.getId())
                .programmeId(s.getProgrammeId())
                .name(s.getName())
                .candidatureIds(fromCsv(s.getCandidatureIds()))
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
