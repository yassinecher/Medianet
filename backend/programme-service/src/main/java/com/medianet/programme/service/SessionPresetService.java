package com.medianet.programme.service;

import com.medianet.programme.dto.SessionPresetDto;
import com.medianet.programme.dto.SessionPresetRequest;
import com.medianet.programme.entity.SessionPreset;
import com.medianet.programme.entity.SessionType;
import com.medianet.programme.repository.SessionPresetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * CRUD for {@link SessionPreset}. Built-in presets are editable but cannot be
 * deleted (the controller maps that rejection to HTTP 409).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SessionPresetService {

    private final SessionPresetRepository repo;

    @Transactional(readOnly = true)
    public List<SessionPresetDto> list(Long programmeId) {
        List<SessionPreset> presets = (programmeId != null)
                ? repo.findVisibleFor(programmeId)
                : repo.findByProgrammeIdIsNullOrderBySortOrderAscIdAsc();
        return presets.stream().map(this::toDto).collect(Collectors.toList());
    }

    public SessionPresetDto create(SessionPresetRequest req) {
        SessionPreset p = SessionPreset.builder()
                .programmeId(req.getProgrammeId())   // null = global
                .sessionType(parseType(req.getSessionType()))
                .title(req.getTitle() != null && !req.getTitle().isBlank() ? req.getTitle().trim() : "Session")
                .color(req.getColor())
                .durationKind(normalizeDuration(req.getDurationKind()))
                .builtIn(false)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : 100)
                .build();
        return toDto(repo.save(p));
    }

    public SessionPresetDto update(Long id, SessionPresetRequest req) {
        SessionPreset p = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Préset introuvable : " + id));
        if (req.getSessionType()  != null) p.setSessionType(parseType(req.getSessionType()));
        if (req.getTitle()        != null && !req.getTitle().isBlank()) p.setTitle(req.getTitle().trim());
        if (req.getColor()        != null) p.setColor(req.getColor());
        if (req.getDurationKind() != null) p.setDurationKind(normalizeDuration(req.getDurationKind()));
        if (req.getSortOrder()    != null) p.setSortOrder(req.getSortOrder());
        // programmeId + builtIn intentionally not reassignable
        return toDto(repo.save(p));
    }

    public void delete(Long id) {
        SessionPreset p = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Préset introuvable : " + id));
        if (Boolean.TRUE.equals(p.getBuiltIn())) {
            throw new IllegalStateException("Les présets par défaut ne peuvent pas être supprimés (vous pouvez les modifier).");
        }
        repo.delete(p);
    }

    private SessionPresetDto toDto(SessionPreset p) {
        return SessionPresetDto.builder()
                .id(p.getId())
                .programmeId(p.getProgrammeId())
                .sessionType(p.getSessionType() != null ? p.getSessionType().name() : SessionType.INCUBATION.name())
                .title(p.getTitle())
                .color(p.getColor())
                .durationKind(normalizeDuration(p.getDurationKind()))
                .builtIn(p.getBuiltIn())
                .sortOrder(p.getSortOrder())
                .build();
    }

    private SessionType parseType(String s) {
        if (s == null || s.isBlank()) return SessionType.INCUBATION;
        try { return SessionType.valueOf(s.toUpperCase()); }
        catch (Exception e) { return SessionType.INCUBATION; }
    }

    private String normalizeDuration(String s) {
        return "day".equalsIgnoreCase(s == null ? "" : s.trim()) ? "day" : "range";
    }
}
