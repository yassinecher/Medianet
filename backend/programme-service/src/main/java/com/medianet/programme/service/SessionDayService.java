package com.medianet.programme.service;

import com.medianet.programme.dto.*;
import com.medianet.programme.entity.*;
import com.medianet.programme.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages {@link SessionDay}s and their {@link SessionActivity} agenda items.
 * The parent session is a {@link ProgrammePhase} (legacy name kept for DB compat).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SessionDayService {

    private final ProgrammePhaseRepository    phaseRepository;
    private final SessionDayRepository        dayRepository;
    private final SessionActivityRepository   activityRepository;
    private final com.medianet.programme.validation.ActivityValidator activityValidator;

    // ── Days ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SessionDayDto> listDays(Long programmeId, Long sessionId) {
        ProgrammePhase s = findSession(programmeId, sessionId);
        return dayRepository.findBySession_IdOrderByDayOrderAsc(s.getId())
                .stream().map(this::toDayDto).collect(Collectors.toList());
    }

    public SessionDayDto addDay(Long programmeId, Long sessionId, CreateSessionDayRequest req) {
        ProgrammePhase s = findSession(programmeId, sessionId);
        SessionDay d = SessionDay.builder()
                .session(s)
                .dayOrder(req.getDayOrder() != null ? req.getDayOrder() : nextDayOrder(s.getId()))
                .title(req.getTitle())
                .description(req.getDescription())
                .date(req.getDate())
                .location(req.getLocation())
                .activities(new ArrayList<>())
                .build();
        d = dayRepository.save(d);

        if (req.getActivities() != null) {
            for (CreateSessionActivityRequest a : req.getActivities()) {
                d.getActivities().add(buildActivity(d, a));
            }
            d = dayRepository.save(d);
        }
        return toDayDto(d);
    }

    public SessionDayDto updateDay(Long programmeId, Long sessionId, Long dayId, UpdateSessionDayRequest req) {
        SessionDay d = findDay(programmeId, sessionId, dayId);
        if (req.getDayOrder()    != null) d.setDayOrder(req.getDayOrder());
        if (req.getTitle()       != null) d.setTitle(req.getTitle());
        if (req.getDescription() != null) d.setDescription(req.getDescription());
        if (req.getDate()        != null) d.setDate(req.getDate());
        if (req.getLocation()    != null) d.setLocation(req.getLocation());
        return toDayDto(dayRepository.save(d));
    }

    public void deleteDay(Long programmeId, Long sessionId, Long dayId) {
        SessionDay d = findDay(programmeId, sessionId, dayId);
        dayRepository.delete(d);
    }

    // ── Activities ───────────────────────────────────────────────────────────

    public SessionActivityDto addActivity(Long programmeId, Long sessionId, Long dayId,
                                          CreateSessionActivityRequest req) {
        SessionDay d = findDay(programmeId, sessionId, dayId);
        activityValidator.validateSessionConstraints(d.getSession());
        activityValidator.validateActivityTimeRange(req.getStartTime(), req.getEndTime());
        SessionActivity a = buildActivity(d, req);
        return toActivityDto(activityRepository.save(a));
    }

    public SessionActivityDto updateActivity(Long programmeId, Long sessionId, Long dayId,
                                             Long activityId, UpdateSessionActivityRequest req) {
        SessionActivity a = findActivity(programmeId, sessionId, dayId, activityId);
        // Resolve the effective start/end after the patch to validate the range.
        activityValidator.validateActivityTimeRange(
                req.getStartTime() != null ? req.getStartTime() : a.getStartTime(),
                req.getEndTime()   != null ? req.getEndTime()   : a.getEndTime());
        if (req.getActivityOrder() != null) a.setActivityOrder(req.getActivityOrder());
        if (req.getTitle()         != null) a.setTitle(req.getTitle());
        if (req.getDescription()   != null) a.setDescription(req.getDescription());
        if (req.getType()          != null) a.setType(parseActivityType(req.getType()));
        if (req.getColor()         != null) a.setColor(req.getColor());
        if (req.getStartTime()     != null) a.setStartTime(req.getStartTime());
        if (req.getEndTime()       != null) a.setEndTime(req.getEndTime());
        if (req.getLocation()      != null) a.setLocation(req.getLocation());
        if (req.getResponsibles()  != null) a.setResponsibles(req.getResponsibles());
        if (req.getGuests()        != null) a.setGuests(req.getGuests());
        return toActivityDto(activityRepository.save(a));
    }

    public void deleteActivity(Long programmeId, Long sessionId, Long dayId, Long activityId) {
        SessionActivity a = findActivity(programmeId, sessionId, dayId, activityId);
        activityRepository.delete(a);
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    public SessionDayDto toDayDto(SessionDay d) {
        return SessionDayDto.builder()
                .id(d.getId())
                .dayOrder(d.getDayOrder())
                .title(d.getTitle())
                .description(d.getDescription())
                .date(d.getDate())
                .location(d.getLocation())
                .activities(d.getActivities() == null
                        ? new ArrayList<>()
                        : d.getActivities().stream().map(this::toActivityDto).collect(Collectors.toList()))
                .build();
    }

    public SessionActivityDto toActivityDto(SessionActivity a) {
        return SessionActivityDto.builder()
                .id(a.getId())
                .activityOrder(a.getActivityOrder())
                .title(a.getTitle())
                .description(a.getDescription())
                .type(a.getType() != null ? a.getType().name() : ActivityType.ACTIVITY.name())
                .color(a.getColor())
                .startTime(a.getStartTime())
                .endTime(a.getEndTime())
                .location(a.getLocation())
                .responsibles(a.getResponsibles() != null ? new ArrayList<>(a.getResponsibles()) : new ArrayList<>())
                .guests(a.getGuests() != null ? new ArrayList<>(a.getGuests()) : new ArrayList<>())
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private SessionActivity buildActivity(SessionDay d, CreateSessionActivityRequest req) {
        return SessionActivity.builder()
                .day(d)
                .activityOrder(req.getActivityOrder() != null ? req.getActivityOrder() : 0)
                .title(req.getTitle())
                .description(req.getDescription())
                .type(parseActivityType(req.getType()))
                .color(req.getColor())
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .location(req.getLocation())
                .responsibles(req.getResponsibles() != null ? req.getResponsibles() : new ArrayList<>())
                .guests(req.getGuests() != null ? req.getGuests() : new ArrayList<>())
                .build();
    }

    private ProgrammePhase findSession(Long programmeId, Long sessionId) {
        return phaseRepository.findById(sessionId)
                .filter(s -> s.getProgramme().getId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
    }

    private SessionDay findDay(Long programmeId, Long sessionId, Long dayId) {
        SessionDay d = dayRepository.findById(dayId)
                .orElseThrow(() -> new IllegalArgumentException("Day not found: " + dayId));
        if (!d.getSession().getId().equals(sessionId)
            || !d.getSession().getProgramme().getId().equals(programmeId)) {
            throw new IllegalArgumentException("Day does not belong to session " + sessionId);
        }
        return d;
    }

    private SessionActivity findActivity(Long programmeId, Long sessionId, Long dayId, Long activityId) {
        SessionActivity a = activityRepository.findById(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found: " + activityId));
        if (!a.getDay().getId().equals(dayId)
            || !a.getDay().getSession().getId().equals(sessionId)
            || !a.getDay().getSession().getProgramme().getId().equals(programmeId)) {
            throw new IllegalArgumentException("Activity not in this day");
        }
        return a;
    }

    private int nextDayOrder(Long sessionId) {
        return dayRepository.findBySession_IdOrderByDayOrderAsc(sessionId).size() + 1;
    }

    private ActivityType parseActivityType(String s) {
        if (s == null || s.isBlank()) return ActivityType.ACTIVITY;
        try { return ActivityType.valueOf(s.toUpperCase()); }
        catch (Exception e) { return ActivityType.ACTIVITY; }
    }
}
