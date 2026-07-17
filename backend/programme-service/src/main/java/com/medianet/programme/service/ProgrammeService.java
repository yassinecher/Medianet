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
    private final com.medianet.programme.validation.SessionValidator sessionValidator;
    private final InvitationLookup            invitationLookup;

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
                .eligibleOrgTypes(req.getEligibleOrgTypes() != null ? req.getEligibleOrgTypes() : new ArrayList<>())
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
        return getAllProgrammes(status, type, false);
    }

    /** Statuses a porteur should never see in the front-office. */
    private static final java.util.Set<ProgrammeStatus> HIDDEN_FROM_PUBLIC =
            java.util.EnumSet.of(ProgrammeStatus.DRAFT, ProgrammeStatus.ARCHIVED, ProgrammeStatus.CANCELLED);

    public List<ProgrammeDto> getAllProgrammes(String status, String type, boolean publicOnly) {
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
        java.util.stream.Stream<Programme> stream = list.stream();
        if (publicOnly) {
            // Front-office: never expose draft / archived / cancelled programmes.
            stream = stream.filter(p -> p.getStatus() == null || !HIDDEN_FROM_PUBLIC.contains(p.getStatus()));
            // …and never expose PRIVATE programmes in the open catalogue. Invitees
            // reach theirs through /programmes/invited (by explicit invitation).
            stream = stream.filter(p -> p.getType() != ProgrammeType.PRIVATE);
        }
        return stream.map(this::toDto).collect(Collectors.toList());
    }

    /**
     * Programmes the caller was invited to, resolved by id. Used by the front
     * office to surface PRIVATE programmes to exactly their invitees (and no one
     * else). DRAFT/archived are still excluded — an invitation to a draft shows
     * nothing until it opens.
     */
    @Transactional(readOnly = true)
    public List<ProgrammeDto> getInvitedProgrammes(java.util.List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return programmeRepository.findAllById(ids).stream()
                .filter(p -> p.getStatus() == null || !HIDDEN_FROM_PUBLIC.contains(p.getStatus()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** The private/other programmes the CURRENT caller was invited to. Ids are
     *  resolved from the caller's token via notification-service, never trusted
     *  from the client. */
    @Transactional(readOnly = true)
    public List<ProgrammeDto> getMyInvitedProgrammes() {
        return getInvitedProgrammes(invitationLookup.invitedProgrammeIds());
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
        if (req.getEligibleOrgTypes()    != null) p.setEligibleOrgTypes(req.getEligibleOrgTypes());
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
        return filterVisible(phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(programmeId))
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
                .evaluationSelectionId(req.getEvaluationSelectionId())
                .sessionType(parseSessionType(req.getSessionType()))
                .lane(parseLane(req.getLane()))
                .color(req.getColor())
                .parentSessionId(validateParent(programmeId, req.getParentSessionId(),
                        normalizeDuration(req.getDurationKind()), req.getStartDate()))
                .build();
        phase.setDurationKind(normalizeDuration(req.getDurationKind()));
        // Visibility + capability flags (default VISIBLE / activities-on / no-overlap).
        phase.setVisibility(parseVisibility(req.getVisibility()));
        phase.setAllowActivities(req.getAllowActivities() != null ? req.getAllowActivities() : Boolean.TRUE);
        phase.setAllowOverlap(req.getAllowOverlap() != null ? req.getAllowOverlap() : Boolean.FALSE);
        enforceActivityPolicy(phase);
        // Enforce the date rules of the three session shapes (day / range / nested).
        validateAndNormalizeDates(phase, true);
        // Centralised domain validation (date range vs programme + overlap).
        sessionValidator.validate(phase, p, phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(programmeId));
        phase = phaseRepository.save(phase);

        // Optional initial days
        if (req.getDays() != null && !req.getDays().isEmpty()) {
            for (CreateSessionDayRequest d : req.getDays()) {
                sessionDayService.addDay(programmeId, phase.getId(), d);
            }
        }
        // Make the fresh phase visible to recompute/sync (collection may be stale).
        final ProgrammePhase saved = phase;
        if (p.getPhases() != null && p.getPhases().stream().noneMatch(ph -> saved.getId().equals(ph.getId())))
            p.getPhases().add(saved);
        // A new session could already imply a programme status change
        boolean changed = programmeLifecycle.recompute(p);
        if (syncApplicationDeadline(p)) changed = true;
        if (changed) programmeRepository.save(p);
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
        if (req.getDurationKind()    != null) phase.setDurationKind(normalizeDuration(req.getDurationKind()));
        if (req.getResponsibles()    != null) phase.setResponsibles(req.getResponsibles());
        if (req.getGuests()          != null) phase.setGuests(req.getGuests());
        if (req.getStartupIds()      != null) phase.setStartupIds(req.getStartupIds());
        if (req.getTasks()           != null) phase.setTasks(req.getTasks());
        if (req.getCriterionWeightsJson() != null) phase.setCriterionWeightsJson(req.getCriterionWeightsJson());
        // -1 = explicit clear (back to « toutes les candidatures »)
        if (req.getEvaluationSelectionId() != null)
            phase.setEvaluationSelectionId(req.getEvaluationSelectionId() < 0 ? null : req.getEvaluationSelectionId());
        if (req.getSessionType()     != null) phase.setSessionType(parseSessionType(req.getSessionType()));
        if (req.getVisibility()      != null) phase.setVisibility(parseVisibility(req.getVisibility()));
        if (req.getCollectPitchVideos() != null) phase.setCollectPitchVideos(req.getCollectPitchVideos());
        if (req.getPitchDeadline()   != null)
            phase.setPitchDeadline(req.getPitchDeadline().isBefore(java.time.LocalDate.of(1971, 1, 1)) ? null : req.getPitchDeadline());
        if (req.getAllowActivities() != null) phase.setAllowActivities(req.getAllowActivities());
        if (req.getAllowOverlap()    != null) phase.setAllowOverlap(req.getAllowOverlap());
        if (req.getLane()            != null) phase.setLane(parseLane(req.getLane()));
        if (req.getColor()           != null) phase.setColor(req.getColor());
        if (req.getParentSessionId() != null) {
            // -1 is the explicit "detach" sentinel from the UI/AI
            if (req.getParentSessionId() < 0) {
                phase.setParentSessionId(null);
            } else {
                phase.setParentSessionId(validateParent(programmeId, req.getParentSessionId(),
                        phase.getDurationKind(), phase.getStartDate()));
            }
        }
        enforceActivityPolicy(phase);
        // Only re-run the date/nesting checks when the edit actually changed dates
        // — a type/visibility/flag edit must not be blocked by stale nesting.
        boolean datesTouched = req.getStartDate() != null || req.getEndDate() != null
                || req.getDurationKind() != null || req.getParentSessionId() != null;
        validateAndNormalizeDates(phase, datesTouched);
        if (datesTouched) {
            sessionValidator.validate(phase, phase.getProgramme(),
                    phaseRepository.findByProgrammeIdOrderByPhaseOrderAsc(programmeId));
        }
        phase = phaseRepository.save(phase);

        // Status of a session may imply a programme transition
        Programme p = phase.getProgramme();
        boolean changed = programmeLifecycle.recompute(p);
        if (syncApplicationDeadline(p)) changed = true;
        if (changed) programmeRepository.save(p);
        return toPhaseDto(phase);
    }

    public void deletePhase(Long programmeId, Long phaseId) {
        ProgrammePhase phase = phaseRepository.findById(phaseId)
                .filter(ph -> ph.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));
        // Cascade: a range session owns its nested day-sessions — remove them too.
        List<ProgrammePhase> children = phaseRepository.findByParentSessionId(phaseId);
        if (!children.isEmpty()) phaseRepository.deleteAll(children);
        Programme p = phase.getProgramme();
        phaseRepository.delete(phase);
        // Removing a session may imply a programme status transition.
        if (p != null) {
            p.getPhases().removeIf(ph -> ph.getId().equals(phaseId)
                    || children.stream().anyMatch(c -> c.getId().equals(ph.getId())));
            boolean changed = programmeLifecycle.recompute(p);
            if (syncApplicationDeadline(p)) changed = true;
            if (changed) programmeRepository.save(p);
        }
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private ProgrammeDto toDto(Programme p) {
        ProgrammePhase cs = candidatureSession(p);
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
                .eligibleOrgTypes(p.getEligibleOrgTypes() != null ? new ArrayList<>(p.getEligibleOrgTypes()) : new ArrayList<>())
                .criteria(p.getCriteria().stream().map(this::toCriteriaDto).collect(Collectors.toList()))
                .phases(filterVisible(p.getPhases()).stream().map(this::toPhaseDto).collect(Collectors.toList()))
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
                .acceptingApplications(isAccepting(p))
                .candidatureSessionId(cs != null ? cs.getId() : null)
                .candidatureDeadline(cs != null ? (cs.getEndDate() != null ? cs.getEndDate() : cs.getStartDate()) : null)
                .build();
    }

    /**
     * Keep the programme's « clôture candidatures » in lockstep with its
     * candidature session: the deadline IS the end of that session's window.
     * No-op when the programme has no candidature session (manual deadline kept).
     */
    private boolean syncApplicationDeadline(Programme p) {
        ProgrammePhase cs = candidatureSession(p);
        if (cs == null) return false;
        java.time.LocalDate deadline = cs.getEndDate() != null ? cs.getEndDate() : cs.getStartDate();
        if (deadline == null || deadline.equals(p.getApplicationDeadline())) return false;
        p.setApplicationDeadline(deadline);
        return true;
    }

    /** The candidature session (CANDIDATURE_SUBMISSION), earliest if several; null if none. */
    private ProgrammePhase candidatureSession(Programme p) {
        if (p.getPhases() == null) return null;
        return p.getPhases().stream()
                .filter(ph -> ph.getParentSessionId() == null)
                .filter(ph -> ph.getSessionType() == SessionType.CANDIDATURE_SUBMISSION)
                .filter(ph -> ph.getStartDate() != null)
                .min(java.util.Comparator.comparing(ProgrammePhase::getStartDate))
                .orElse(null);
    }

    /** Accepting candidatures = status not held/closed AND (candidature session active, or
     *  legacy programmes without a candidature session simply OPEN). */
    private boolean isAccepting(Programme p) {
        ProgrammeStatus st = p.getStatus();
        if (st == ProgrammeStatus.DRAFT || st == ProgrammeStatus.CLOSED
                || st == ProgrammeStatus.ARCHIVED || st == ProgrammeStatus.CANCELLED) return false;
        ProgrammePhase cs = candidatureSession(p);
        if (cs == null) return st == ProgrammeStatus.OPEN;
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate start = cs.getStartDate();
        java.time.LocalDate end = cs.getEndDate() != null ? cs.getEndDate() : start;
        return start != null && !today.isBefore(start) && !today.isAfter(end);
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
                .durationKind(normalizeDuration(ph.getDurationKind()))
                .responsibles(ph.getResponsibles())
                .guests(ph.getGuests())
                .startupIds(ph.getStartupIds())
                .tasks(ph.getTasks())
                .criterionWeightsJson(ph.getCriterionWeightsJson())
                .evaluationSelectionId(ph.getEvaluationSelectionId())
                .sessionType(ph.getSessionType() != null ? ph.getSessionType().name() : SessionType.INCUBATION.name())
                .visibility((ph.getVisibility() != null ? ph.getVisibility() : SessionVisibility.VISIBLE).name())
                .isPublic((ph.getVisibility() == null || ph.getVisibility() == SessionVisibility.VISIBLE))
                .collectPitchVideos(Boolean.TRUE.equals(ph.getCollectPitchVideos()))
                .pitchDeadline(ph.getPitchDeadline())
                .allowActivities(ph.getAllowActivities() == null ? Boolean.TRUE : ph.getAllowActivities())
                .allowOverlap(ph.getAllowOverlap() == null ? Boolean.FALSE : ph.getAllowOverlap())
                .lane(ph.getLane() != null && !ph.getLane().isBlank() ? ph.getLane() : "Principal")
                .color(ph.getColor())
                .parentSessionId(ph.getParentSessionId())
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

    @Transactional(readOnly = true)
    public List<PartnerDto> getProgrammePartners(Long programmeId) {
        Programme p = findOrThrow(programmeId);
        return p.getPartners().stream().map(this::toPartnerDto).collect(Collectors.toList());
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

    private SessionVisibility parseVisibility(String s) {
        if (s == null || s.isBlank()) return SessionVisibility.VISIBLE;
        try { return SessionVisibility.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid session visibility: " + s); }
    }

    /**
     * APPLICATION/CANDIDATURE submission sessions manage candidates, never an
     * activity agenda — force {@code allowActivities=false} regardless of input.
     */
    private void enforceActivityPolicy(ProgrammePhase phase) {
        if (phase.getSessionType() == SessionType.CANDIDATURE_SUBMISSION) {
            phase.setAllowActivities(Boolean.FALSE);
        }
    }

    /** Visibility enforcement: non-privileged callers (startups, jurys, members)
     *  only ever receive VISIBLE sessions; HIDDEN/PRIVATE are reserved for
     *  admins / programme managers. Applied to every session list the API returns. */
    private List<ProgrammePhase> filterVisible(List<ProgrammePhase> phases) {
        if (phases == null) return new ArrayList<>();
        if (isPrivilegedViewer()) return phases;
        boolean hasRestricted = phases.stream()
                .anyMatch(ph -> ph.getVisibility() != null && ph.getVisibility() != SessionVisibility.VISIBLE);
        // Only pay the notification-service lookup when there's something to unlock.
        final java.util.Set<Long> invited = hasRestricted
                ? new java.util.HashSet<>(invitationLookup.invitedPhaseIds())
                : java.util.Collections.emptySet();
        return phases.stream()
                .filter(ph -> ph.getVisibility() == null
                        || ph.getVisibility() == SessionVisibility.VISIBLE
                        // HIDDEN/PRIVATE: visible to users explicitly invited to that session.
                        || (ph.getId() != null && invited.contains(ph.getId())))
                .collect(Collectors.toList());
    }

    /** True when the caller may see HIDDEN/PRIVATE sessions (admin / programme manager). */
    private boolean isPrivilegedViewer() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (var a : auth.getAuthorities()) {
            String s = a.getAuthority();
            if ("ROLE_ADMIN".equals(s) || "programmes:update".equals(s) || "programmes:read".equals(s)) return true;
        }
        return false;
    }

    /**
     * Collapse the loose legacy duration values to the two-kind model.
     * "day" stays "day"; anything else ("range", "week", "custom", null) → "range".
     */
    private String normalizeDuration(String s) {
        return "day".equalsIgnoreCase(s == null ? "" : s.trim()) ? "day" : "range";
    }

    /**
     * Validate + normalize a session's effective dates against the rules of the
     * three session shapes. Mutates {@code startDate}/{@code endDate} to the
     * normalized values; throws {@link IllegalArgumentException} on a violation
     * (caught by the global handler → 400 with the message).
     *
     * <ul>
     *   <li><b>Day session</b> — a single calendar day: {@code endDate} forced to
     *       {@code startDate}.</li>
     *   <li><b>Range session</b> — {@code startDate} must not be after
     *       {@code endDate} (missing end defaults to start).</li>
     *   <li><b>Nested session</b> (has a parent range) — its whole window must
     *       stay inside the parent's {@code [start, end]}.</li>
     *   <li><b>Range with nested journées</b> — the (possibly shrunk/moved) window
     *       must still contain every child's date; otherwise it would orphan a
     *       journée, which is rejected with a clear message.</li>
     * </ul>
     */
    private void validateAndNormalizeDates(ProgrammePhase phase, boolean datesTouched) {
        String kind = normalizeDuration(phase.getDurationKind());
        java.time.LocalDate start = phase.getStartDate();
        java.time.LocalDate end   = phase.getEndDate();

        if (start == null) {
            // No start date yet (draft) — nothing date-wise to validate.
            if ("day".equals(kind)) phase.setEndDate(null);
            return;
        }

        if ("day".equals(kind)) {
            // A journée spans exactly one day.
            end = start;
            phase.setEndDate(start);
        } else {
            if (end == null) { end = start; phase.setEndDate(start); }
            if (start.isAfter(end)) {
                throw new IllegalArgumentException(
                        "La date de début (" + start + ") doit précéder la date de fin (" + end + ") de la plage.");
            }
        }

        // The containment checks below only matter when the dates actually change.
        // A non-date edit (e.g. switching the session type) must never be blocked
        // by a pre-existing nesting that drifted out of window.
        if (!datesTouched) return;

        // Nested session → must remain entirely within the parent range window.
        if (phase.getParentSessionId() != null) {
            ProgrammePhase parent = phaseRepository.findById(phase.getParentSessionId()).orElse(null);
            if (parent != null && parent.getStartDate() != null && parent.getEndDate() != null) {
                java.time.LocalDate ps = parent.getStartDate();
                java.time.LocalDate pe = parent.getEndDate();
                boolean outOfWindow = start.isBefore(ps) || start.isAfter(pe)
                        || (end != null && (end.isBefore(ps) || end.isAfter(pe)));
                if (outOfWindow) {
                    throw new IllegalArgumentException(
                            "La session imbriquée « " + safeTitle(phase) + " » doit rester dans la plage parente ("
                            + ps + " → " + pe + ").");
                }
            }
        }

        // Range with nested journées → the new window must still contain them all.
        if ("range".equals(kind) && phase.getId() != null) {
            for (ProgrammePhase ch : phaseRepository.findByParentSessionId(phase.getId())) {
                java.time.LocalDate cs = ch.getStartDate();
                java.time.LocalDate ce = ch.getEndDate() != null ? ch.getEndDate() : cs;
                if (cs != null && (cs.isBefore(start) || cs.isAfter(end)
                        || (ce != null && ce.isAfter(end)))) {
                    throw new IllegalArgumentException(
                            "Impossible de déplacer/réduire la plage : la journée « " + safeTitle(ch) + " » ("
                            + cs + ") en sortirait. Déplacez-la d'abord ou élargissez la plage.");
                }
            }
        }
    }

    private static String safeTitle(ProgrammePhase p) {
        String t = p.getTitle();
        return (t == null || t.isBlank()) ? "Sans titre" : t;
    }

    /**
     * Validate a requested parent (range) session for a child day-session.
     * Rules: parent must exist in the same programme, must itself be a range
     * (not a day), the child must be a day kind, and the child's start date must
     * fall within the parent's [startDate, endDate] window. Returns the parent id
     * to store, or null when no parent requested.
     */
    private Long validateParent(Long programmeId, Long parentId, String childDuration, java.time.LocalDate childStart) {
        if (parentId == null) return null;
        ProgrammePhase parent = phaseRepository.findById(parentId)
                .filter(ph -> ph.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Session parente introuvable dans ce programme : " + parentId));
        // Only a "range" session can contain others — a "day" has no window.
        if ("day".equalsIgnoreCase(normalizeDuration(parent.getDurationKind()))) {
            throw new IllegalArgumentException(
                    "Une session « Journée » ne peut pas contenir d'autres sessions — choisissez une session « Plage ».");
        }
        // A day OR a range may nest, as long as its start date falls within the
        // parent's window (the child's dates "belong to" the parent range).
        if (childStart != null && parent.getStartDate() != null && parent.getEndDate() != null
                && (childStart.isBefore(parent.getStartDate()) || childStart.isAfter(parent.getEndDate()))) {
            throw new IllegalArgumentException(
                    "La date doit être comprise dans la plage de la session parente ("
                    + parent.getStartDate() + " → " + parent.getEndDate() + ").");
        }
        return parentId;
    }
}
