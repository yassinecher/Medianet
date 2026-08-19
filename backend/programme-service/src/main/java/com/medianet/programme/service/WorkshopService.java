package com.medianet.programme.service;

import com.medianet.programme.dto.WorkshopDto;
import com.medianet.programme.dto.WorkshopRequest;
import com.medianet.programme.dto.WorkshopTargetDto;
import com.medianet.programme.entity.ProgrammeParticipant;
import com.medianet.programme.entity.Workshop;
import com.medianet.programme.repository.ProgrammeParticipantRepository;
import com.medianet.programme.repository.ProgrammePhaseRepository;
import com.medianet.programme.repository.ProgrammeRepository;
import com.medianet.programme.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Workshops / ateliers held for specific incubated startups within a programme.
 * Each target is a participation, so the startup's mentor comes along for free.
 * Managed by an admin (create/edit/delete); read by the calendar of the targeted
 * porteurs and their mentors.
 */
@Service
@RequiredArgsConstructor
public class WorkshopService {

    private final WorkshopRepository repo;
    private final ProgrammeParticipantRepository participantRepository;
    private final ProgrammePhaseRepository phaseRepository;
    private final ProgrammeRepository programmeRepository;

    @Transactional(readOnly = true)
    public List<WorkshopDto> listForProgramme(Long programmeId) {
        return repo.findByProgrammeIdOrderByWorkshopDateAscIdAsc(programmeId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    /** Workshops relevant to the caller — as mentor OR porteur of a target startup. */
    @Transactional(readOnly = true)
    public List<WorkshopDto> myWorkshops(Long userId) {
        if (userId == null) return List.of();
        Set<Long> mine = new HashSet<>();
        participantRepository.findByMentorUserId(userId).forEach(p -> mine.add(p.getId()));
        participantRepository.findByPorteurUserId(userId).forEach(p -> mine.add(p.getId()));
        if (mine.isEmpty()) return List.of();
        return repo.findByTargetParticipantIds(mine).stream().map(this::toDto).collect(Collectors.toList());
    }

    public WorkshopDto create(Long programmeId, Long userId, WorkshopRequest req) {
        if (req.getTitle() == null || req.getTitle().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre de l'atelier est requis.");
        Workshop w = Workshop.builder()
                .programmeId(programmeId)
                .createdByUserId(userId)
                .targetParticipantIds(new HashSet<>())
                .build();
        apply(w, programmeId, req);
        return toDto(repo.save(w));
    }

    public WorkshopDto update(Long id, WorkshopRequest req) {
        Workshop w = find(id);
        apply(w, w.getProgrammeId(), req);
        return toDto(repo.save(w));
    }

    public void delete(Long id) {
        repo.delete(find(id));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void apply(Workshop w, Long programmeId, WorkshopRequest req) {
        if (req.getTitle() != null) w.setTitle(req.getTitle().trim());
        w.setDescription(req.getDescription());
        if (req.getFormat() != null && !req.getFormat().isBlank()) w.setFormat(req.getFormat().trim());
        if (req.getStatus() != null && !req.getStatus().isBlank()) w.setStatus(req.getStatus().trim().toUpperCase());
        w.setPhaseId(req.getPhaseId());
        w.setWorkshopDate(req.getWorkshopDate());
        w.setStartTime(req.getStartTime());
        w.setEndTime(req.getEndTime());
        w.setLocation(req.getLocation());
        w.setFacilitator(req.getFacilitator());
        // Keep only targets that really belong to this programme.
        Set<Long> valid = participantRepository.findByProgrammeId(programmeId)
                .stream().map(ProgrammeParticipant::getId).collect(Collectors.toSet());
        Set<Long> targets = new LinkedHashSet<>();
        if (req.getTargetParticipantIds() != null)
            req.getTargetParticipantIds().stream().filter(valid::contains).forEach(targets::add);
        w.setTargetParticipantIds(targets);
    }

    private Workshop find(Long id) {
        return repo.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Atelier introuvable."));
    }

    private WorkshopDto toDto(Workshop w) {
        // Enrich targets from the current participations (org + mentor snapshot).
        Map<Long, ProgrammeParticipant> byId = participantRepository
                .findAllById(w.getTargetParticipantIds())
                .stream().collect(Collectors.toMap(ProgrammeParticipant::getId, Function.identity()));
        List<WorkshopTargetDto> targets = w.getTargetParticipantIds().stream()
                .map(byId::get).filter(p -> p != null)
                .map(p -> WorkshopTargetDto.builder()
                        .participantId(p.getId())
                        .organizationId(p.getOrganizationId())
                        .organizationName(p.getOrganizationName())
                        .mentorUserId(p.getMentorUserId())
                        .mentorName(p.getMentorName())
                        .porteurUserId(p.getPorteurUserId())
                        .porteurName(p.getPorteurName())
                        .build())
                .collect(Collectors.toList());
        String phaseTitle = w.getPhaseId() == null ? null
                : phaseRepository.findById(w.getPhaseId()).map(ph -> ph.getTitle()).orElse(null);
        String programmeName = programmeRepository.findById(w.getProgrammeId())
                .map(pr -> pr.getTitle()).orElse(null);
        return WorkshopDto.builder()
                .id(w.getId()).programmeId(w.getProgrammeId()).programmeName(programmeName)
                .phaseId(w.getPhaseId()).phaseTitle(phaseTitle)
                .title(w.getTitle()).description(w.getDescription())
                .format(w.getFormat()).status(w.getStatus())
                .workshopDate(w.getWorkshopDate()).startTime(w.getStartTime()).endTime(w.getEndTime())
                .location(w.getLocation()).facilitator(w.getFacilitator())
                .targets(targets).createdAt(w.getCreatedAt())
                .build();
    }
}
