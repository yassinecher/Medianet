package com.medianet.programme.service;

import com.medianet.programme.dto.*;
import com.medianet.programme.entity.*;
import com.medianet.programme.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ProgrammeService {

    private final ProgrammeRepository         programmeRepository;
    private final ProgrammeCriteriaRepository criteriaRepository;
    private final ProgrammePhaseRepository    phaseRepository;
    private final PartnerRepository           partnerRepository;
    private final ProgrammeLifecycle          programmeLifecycle;
    private final SessionDayService           sessionDayService;

    // ── Programme CRUD ────────────────────────────────────────────────────────

    public ProgrammeDto createProgramme(CreateProgrammeRequest req, Long adminId, String adminName) {
        Programme p = Programme.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .type(parseType(req.getType()))
                .status(req.getStatus() != null ? parseStatus(req.getStatus()) : ProgrammeStatus.DRAFT)
                .formTemplate(parseFormTemplate(req.getFormTemplate()))
                .customFormSchema(req.getCustomFormSchema())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .applicationDeadline(req.getApplicationDeadline())
                .maxApplications(req.getMaxApplications())
                .sectors(req.getSectors() != null ? req.getSectors() : new ArrayList<>())
                .tagline(req.getTagline())
                .logoUrl(req.getLogoUrl())
                .bannerImageUrl(req.getBannerImageUrl())
                .location(req.getLocation())
                .applicationUrl(req.getApplicationUrl())
                .expertCount(req.getExpertCount())
                .trainingSessionsCount(req.getTrainingSessionsCount())
                .mentoringHoursPerMonth(req.getMentoringHoursPerMonth())
                .maxStartups(req.getMaxStartups())
                .objectives(req.getObjectives() != null ? req.getObjectives() : new ArrayList<>())
                .benefits(req.getBenefits() != null ? req.getBenefits() : new ArrayList<>())
                .createdByAdminId(adminId)
                .createdByAdminName(adminName)
                .build();
        return toDto(programmeRepository.save(p));
    }

    @Transactional(readOnly = true)
    public List<ProgrammeDto> getAllProgrammes(String status, String type) {
        List<Programme> list;
        if (status != null && type != null) {
            list = programmeRepository.findByTypeAndStatus(parseType(type), parseStatus(status));
        } else if (status != null) {
            list = programmeRepository.findByStatus(parseStatus(status));
        } else if (type != null) {
            list = programmeRepository.findByType(parseType(type));
        } else {
            list = programmeRepository.findAll();
        }
        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProgrammeDto getProgrammeById(Long id) {
        return toDto(findOrThrow(id));
    }

    public ProgrammeDto updateProgramme(Long id, UpdateProgrammeRequest req) {
        Programme p = findOrThrow(id);
        if (req.getTitle()               != null) p.setTitle(req.getTitle());
        if (req.getDescription()         != null) p.setDescription(req.getDescription());
        if (req.getType()                != null) p.setType(parseType(req.getType()));
        if (req.getStatus()              != null) p.setStatus(parseStatus(req.getStatus()));
        if (req.getFormTemplate()        != null) p.setFormTemplate(parseFormTemplate(req.getFormTemplate()));
        // customFormSchema: explicit empty string ("") clears it
        if (req.getCustomFormSchema()    != null) p.setCustomFormSchema(req.getCustomFormSchema().isBlank() ? null : req.getCustomFormSchema());
        if (req.getStartDate()           != null) p.setStartDate(req.getStartDate());
        if (req.getEndDate()             != null) p.setEndDate(req.getEndDate());
        if (req.getApplicationDeadline() != null) p.setApplicationDeadline(req.getApplicationDeadline());
        if (req.getMaxApplications()     != null) p.setMaxApplications(req.getMaxApplications());
        if (req.getSectors()             != null) p.setSectors(req.getSectors());
        if (req.getTagline()             != null) p.setTagline(req.getTagline());
        if (req.getLogoUrl()             != null) p.setLogoUrl(req.getLogoUrl());
        if (req.getBannerImageUrl()      != null) p.setBannerImageUrl(req.getBannerImageUrl());
        if (req.getLocation()            != null) p.setLocation(req.getLocation());
        if (req.getApplicationUrl()      != null) p.setApplicationUrl(req.getApplicationUrl());
        if (req.getExpertCount()         != null) p.setExpertCount(req.getExpertCount());
        if (req.getTrainingSessionsCount()!= null) p.setTrainingSessionsCount(req.getTrainingSessionsCount());
        if (req.getMentoringHoursPerMonth()!= null) p.setMentoringHoursPerMonth(req.getMentoringHoursPerMonth());
        if (req.getMaxStartups()         != null) p.setMaxStartups(req.getMaxStartups());
        if (req.getObjectives()          != null) p.setObjectives(req.getObjectives());
        if (req.getBenefits()            != null) p.setBenefits(req.getBenefits());
        return toDto(programmeRepository.save(p));
    }

    public ProgrammeDto updateStatus(Long id, String status) {
        Programme p = findOrThrow(id);
        p.setStatus(parseStatus(status));
        return toDto(programmeRepository.save(p));
    }

    /**
     * Permanently delete a programme. Cascades to phases + criteria (orphanRemoval=true
     * on the @OneToMany) and detaches partners via the join table cleanup.
     */
    public void deleteProgramme(Long id) {
        Programme p = findOrThrow(id);
        // Clear ManyToMany partner links explicitly (Hibernate doesn't auto-clean these)
        if (p.getPartners() != null) p.getPartners().clear();
        programmeRepository.delete(p);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        for (ProgrammeStatus s : ProgrammeStatus.values()) {
            stats.put(s.name(), programmeRepository.countByStatus(s));
        }
        return stats;
    }

    // ── Criteria ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProgrammeCriteriaDto> getCriteria(Long programmeId) {
        findOrThrow(programmeId);
        return criteriaRepository.findByProgrammeIdOrderByCriterionOrderAsc(programmeId)
                .stream().map(this::toCriteriaDto).collect(Collectors.toList());
    }

    public ProgrammeCriteriaDto addCriterion(Long programmeId, CreateCriteriaRequest req) {
        Programme p = findOrThrow(programmeId);
        ProgrammeCriteria c = ProgrammeCriteria.builder()
                .programme(p)
                .name(req.getName())
                .description(req.getDescription())
                .weight(req.getWeight() != null ? req.getWeight() : 0.0)
                .criterionOrder(req.getCriterionOrder() != null ? req.getCriterionOrder() : 0)
                .aiGenerated(Boolean.TRUE.equals(req.getAiGenerated()))
                .build();
        return toCriteriaDto(criteriaRepository.save(c));
    }

    public ProgrammeCriteriaDto updateCriterion(Long programmeId, Long criterionId, UpdateCriteriaRequest req) {
        ProgrammeCriteria c = criteriaRepository.findById(criterionId)
                .filter(cr -> cr.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Criterion not found: " + criterionId));
        if (req.getName()          != null) c.setName(req.getName());
        if (req.getDescription()   != null) c.setDescription(req.getDescription());
        if (req.getWeight()        != null) c.setWeight(req.getWeight());
        if (req.getCriterionOrder()!= null) c.setCriterionOrder(req.getCriterionOrder());
        if (req.getActive()        != null) c.setActive(req.getActive());
        return toCriteriaDto(criteriaRepository.save(c));
    }

    public void deleteCriterion(Long programmeId, Long criterionId) {
        ProgrammeCriteria c = criteriaRepository.findById(criterionId)
                .filter(cr -> cr.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Criterion not found: " + criterionId));
        criteriaRepository.delete(c);
    }

    // ── Phases ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProgrammePhaseDto> getPhases(Long programmeId) {
        findOrThrow(programmeId);
        return phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(programmeId)
                .stream().map(this::toPhaseDto).collect(Collectors.toList());
    }

    public ProgrammePhaseDto addPhase(Long programmeId, CreatePhaseRequest req) {
        Programme p = findOrThrow(programmeId);
        ProgrammePhase phase = ProgrammePhase.builder()
                .programme(p)
                .title(req.getTitle())
                .description(req.getDescription())
                .phaseOrder(req.getPhaseOrder() != null ? req.getPhaseOrder() : 0)
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .focusCriteriaIds(req.getFocusCriteriaIds() != null ? req.getFocusCriteriaIds() : new ArrayList<>())
                .location(req.getLocation())
                .durationKind(req.getDurationKind() != null ? req.getDurationKind() : "day")
                .responsibles(req.getResponsibles() != null ? req.getResponsibles() : new ArrayList<>())
                .guests(req.getGuests()             != null ? req.getGuests()       : new ArrayList<>())
                .startupIds(req.getStartupIds()     != null ? req.getStartupIds()   : new ArrayList<>())
                .tasks(req.getTasks()               != null ? req.getTasks()        : new ArrayList<>())
                .criterionWeightsJson(req.getCriterionWeightsJson())
                .sessionType(parseSessionType(req.getSessionType()))
                .lane(parseLane(req.getLane()))
                .build();
        phase = phaseRepository.save(phase);

        // Optional initial days
        if (req.getDays() != null && !req.getDays().isEmpty()) {
            for (CreateSessionDayRequest d : req.getDays()) {
                sessionDayService.addDay(programmeId, phase.getId(), d);
            }
        }
        // A new session could already imply a programme status change
        if (programmeLifecycle.recompute(p)) programmeRepository.save(p);
        return toPhaseDto(phaseRepository.save(phase));
    }

    public ProgrammePhaseDto updatePhase(Long programmeId, Long phaseId, UpdatePhaseRequest req) {
        ProgrammePhase phase = phaseRepository.findById(phaseId)
                .filter(ph -> ph.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));
        if (req.getTitle()           != null) phase.setTitle(req.getTitle());
        if (req.getDescription()     != null) phase.setDescription(req.getDescription());
        if (req.getPhaseOrder()      != null) phase.setPhaseOrder(req.getPhaseOrder());
        if (req.getStartDate()       != null) phase.setStartDate(req.getStartDate());
        if (req.getEndDate()         != null) phase.setEndDate(req.getEndDate());
        if (req.getStatus()          != null) phase.setStatus(parsePhaseStatus(req.getStatus()));
        if (req.getFocusCriteriaIds()!= null) phase.setFocusCriteriaIds(req.getFocusCriteriaIds());
        if (req.getLocation()        != null) phase.setLocation(req.getLocation());
        if (req.getDurationKind()    != null) phase.setDurationKind(req.getDurationKind());
        if (req.getResponsibles()    != null) phase.setResponsibles(req.getResponsibles());
        if (req.getGuests()          != null) phase.setGuests(req.getGuests());
        if (req.getStartupIds()      != null) phase.setStartupIds(req.getStartupIds());
        if (req.getTasks()           != null) phase.setTasks(req.getTasks());
        if (req.getCriterionWeightsJson() != null) phase.setCriterionWeightsJson(req.getCriterionWeightsJson());
        if (req.getSessionType()     != null) phase.setSessionType(parseSessionType(req.getSessionType()));
        if (req.getLane()            != null) phase.setLane(parseLane(req.getLane()));
        phase = phaseRepository.save(phase);

        // Status of a session may imply a programme transition
        Programme p = phase.getProgramme();
        if (programmeLifecycle.recompute(p)) programmeRepository.save(p);
        return toPhaseDto(phase);
    }

    public void deletePhase(Long programmeId, Long phaseId) {
        ProgrammePhase phase = phaseRepository.findById(phaseId)
                .filter(ph -> ph.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));
        phaseRepository.delete(phase);
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private ProgrammeDto toDto(Programme p) {
        return ProgrammeDto.builder()
                .id(p.getId())
                .title(p.getTitle())
                .description(p.getDescription())
                .type(p.getType() != null ? p.getType().name() : null)
                .status(p.getStatus() != null ? p.getStatus().name() : null)
                .formTemplate(p.getFormTemplate() != null ? p.getFormTemplate().name() : "STANDARD")
                .customFormSchema(p.getCustomFormSchema())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .applicationDeadline(p.getApplicationDeadline())
                .maxApplications(p.getMaxApplications())
                .createdByAdminId(p.getCreatedByAdminId())
                .createdByAdminName(p.getCreatedByAdminName())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .sectors(p.getSectors() != null ? new ArrayList<>(p.getSectors()) : new ArrayList<>())
                .criteria(p.getCriteria().stream().map(this::toCriteriaDto).collect(Collectors.toList()))
                .phases(p.getPhases().stream().map(this::toPhaseDto).collect(Collectors.toList()))
                .partners(p.getPartners().stream().map(this::toPartnerDto).collect(Collectors.toList()))
                .tagline(p.getTagline())
                .logoUrl(p.getLogoUrl())
                .bannerImageUrl(p.getBannerImageUrl())
                .location(p.getLocation())
                .applicationUrl(p.getApplicationUrl())
                .expertCount(p.getExpertCount())
                .trainingSessionsCount(p.getTrainingSessionsCount())
                .mentoringHoursPerMonth(p.getMentoringHoursPerMonth())
                .maxStartups(p.getMaxStartups())
                .objectives(p.getObjectives() != null ? new ArrayList<>(p.getObjectives()) : new ArrayList<>())
                .benefits(p.getBenefits() != null ? new ArrayList<>(p.getBenefits()) : new ArrayList<>())
                .build();
    }

    private ProgrammeCriteriaDto toCriteriaDto(ProgrammeCriteria c) {
        return ProgrammeCriteriaDto.builder()
                .id(c.getId())
                .name(c.getName())
                .description(c.getDescription())
                .weight(c.getWeight())
                .criterionOrder(c.getCriterionOrder())
                .aiGenerated(c.getAiGenerated())
                .active(c.getActive())
                .build();
    }

    private ProgrammePhaseDto toPhaseDto(ProgrammePhase ph) {
        return ProgrammePhaseDto.builder()
                .id(ph.getId())
                .title(ph.getTitle())
                .description(ph.getDescription())
                .phaseOrder(ph.getPhaseOrder())
                .startDate(ph.getStartDate())
                .endDate(ph.getEndDate())
                .status(ph.getStatus() != null ? ph.getStatus().name() : null)
                .focusCriteriaIds(ph.getFocusCriteriaIds())
                .location(ph.getLocation())
                .durationKind(ph.getDurationKind())
                .responsibles(ph.getResponsibles())
                .guests(ph.getGuests())
                .startupIds(ph.getStartupIds())
                .tasks(ph.getTasks())
                .criterionWeightsJson(ph.getCriterionWeightsJson())
                .sessionType(ph.getSessionType() != null ? ph.getSessionType().name() : SessionType.INCUBATION.name())
                .lane(ph.getLane() != null && !ph.getLane().isBlank() ? ph.getLane() : "Principal")
                .days(ph.getDays() == null
                        ? new ArrayList<>()
                        : ph.getDays().stream().map(sessionDayService::toDayDto).collect(Collectors.toList()))
                .build();
    }

    // ── Partners ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PartnerDto> getAllPartners() {
        return partnerRepository.findAll().stream().map(this::toPartnerDto).collect(Collectors.toList());
    }

    public PartnerDto createPartner(CreatePartnerRequest req) {
        Partner partner = Partner.builder()
                .name(req.getName())
                .logoUrl(req.getLogoUrl())
                .build();
        return toPartnerDto(partnerRepository.save(partner));
    }

    public void deletePartner(Long partnerId) {
        Partner partner = partnerRepository.findById(partnerId)
                .orElseThrow(() -> new IllegalArgumentException("Partner not found: " + partnerId));
        // Remove from all programmes first
        partner.getProgrammes().forEach(prog -> prog.getPartners().remove(partner));
        partnerRepository.delete(partner);
    }

    public ProgrammeDto addPartnerToProgramme(Long programmeId, Long partnerId) {
        Programme p = findOrThrow(programmeId);
        Partner partner = partnerRepository.findById(partnerId)
                .orElseThrow(() -> new IllegalArgumentException("Partner not found: " + partnerId));
        if (!p.getPartners().contains(partner)) {
            p.getPartners().add(partner);
            partner.getProgrammes().add(p);
        }
        return toDto(programmeRepository.save(p));
    }

    public ProgrammeDto removePartnerFromProgramme(Long programmeId, Long partnerId) {
        Programme p = findOrThrow(programmeId);
        p.getPartners().removeIf(pt -> pt.getId().equals(partnerId));
        return toDto(programmeRepository.save(p));
    }

    private PartnerDto toPartnerDto(Partner pt) {
        return PartnerDto.builder()
                .id(pt.getId())
                .name(pt.getName())
                .logoUrl(pt.getLogoUrl())
                .createdAt(pt.getCreatedAt())
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Programme findOrThrow(Long id) {
        return programmeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Programme not found: " + id));
    }

    private ProgrammeStatus parseStatus(String s) {
        try { return ProgrammeStatus.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid status: " + s); }
    }

    private ProgrammeType parseType(String t) {
        if (t == null) return ProgrammeType.PUBLIC;
        try { return ProgrammeType.valueOf(t.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid type: " + t); }
    }

    private PhaseStatus parsePhaseStatus(String s) {
        try { return PhaseStatus.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid phase status: " + s); }
    }

    private FormTemplate parseFormTemplate(String s) {
        if (s == null || s.isBlank()) return FormTemplate.STANDARD;
        try { return FormTemplate.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid form template: " + s); }
    }

    private SessionType parseSessionType(String s) {
        if (s == null || s.isBlank()) return SessionType.INCUBATION;
        try { return SessionType.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid session type: " + s); }
    }

    private String parseLane(String s) {
        if (s == null) return "Principal";
        String trimmed = s.trim();
        return trimmed.isEmpty() ? "Principal" : trimmed;
    }
}
