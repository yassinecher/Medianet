package com.medianet.programme.service;

import com.medianet.programme.entity.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Derives a {@link ProgrammeStatus} from the programme's session flow.
 *
 * <p>Sessions are type-free, so the flow is purely <b>order + date</b> based: the
 * top-level sessions, sorted by start date, form a pipeline (e.g. Candidature →
 * Présélection → Pitch Day → Incubation → Demo Day). The "current stage" is the
 * one whose date window contains today.
 *
 * <p>Mapping (forgiving; never moves backward off CANCELLED):
 * <ul>
 *   <li>No dated top-level sessions → keep current status.</li>
 *   <li>Today before the first stage starts → {@code OPEN} (accepting / not started).</li>
 *   <li>Today after the last stage ends → {@code CLOSED}.</li>
 *   <li>On the first stage → {@code OPEN}; on any later stage → {@code IN_PROGRESS}.</li>
 * </ul>
 */
@Component
@Slf4j
public class ProgrammeLifecycle {

    public boolean recompute(Programme p) {
        if (p == null) return false;
        // Manual "hold" statuses the admin set explicitly — never auto-override:
        //   DRAFT (not yet published), EVALUATION (manual evaluation phase), CANCELLED.
        // The auto-flow only manages the running states OPEN ↔ IN_PROGRESS ↔ CLOSED.
        ProgrammeStatus cur = p.getStatus();
        if (cur == ProgrammeStatus.CANCELLED || cur == ProgrammeStatus.DRAFT
                || cur == ProgrammeStatus.EVALUATION || cur == ProgrammeStatus.ARCHIVED) return false;

        List<ProgrammePhase> all = p.getPhases();
        if (all == null || all.isEmpty()) return false;

        // Top-level, dated sessions ordered chronologically = the parcours pipeline.
        List<ProgrammePhase> stages = all.stream()
                .filter(s -> s.getParentSessionId() == null)
                .filter(s -> s.getStartDate() != null)
                .sorted(Comparator.comparing(ProgrammePhase::getStartDate))
                .collect(Collectors.toList());
        if (stages.isEmpty()) return false;

        LocalDate today = LocalDate.now();
        ProgrammePhase first = stages.get(0);
        ProgrammePhase last  = stages.get(stages.size() - 1);
        LocalDate firstStart = first.getStartDate();
        LocalDate lastEnd    = endOf(last);

        ProgrammeStatus target;
        if (today.isBefore(firstStart)) {
            target = ProgrammeStatus.OPEN;
        } else if (today.isAfter(lastEnd)) {
            target = ProgrammeStatus.CLOSED;
        } else {
            // Current stage = first session whose end is not before today.
            int idx = stages.size() - 1;
            for (int i = 0; i < stages.size(); i++) {
                if (!endOf(stages.get(i)).isBefore(today)) { idx = i; break; }
            }
            target = (idx == 0) ? ProgrammeStatus.OPEN : ProgrammeStatus.IN_PROGRESS;
        }

        // Session-status synchronization: when the admin has explicitly marked
        // sessions, their status drives the programme (more authoritative than the
        // calendar). All default-UPCOMING → keep the date-derived target above.
        boolean allCompleted = stages.stream().allMatch(s -> s.getStatus() == PhaseStatus.COMPLETED);
        boolean anyActive    = stages.stream().anyMatch(s -> s.getStatus() == PhaseStatus.ACTIVE);
        if (allCompleted)      target = ProgrammeStatus.CLOSED;
        else if (anyActive)    target = ProgrammeStatus.IN_PROGRESS;

        if (target != p.getStatus()) {
            log.info("Programme {} status {} → {} (driven by session flow)",
                    p.getId(), p.getStatus(), target);
            p.setStatus(target);
            return true;
        }
        return false;
    }

    private static LocalDate endOf(ProgrammePhase s) {
        return s.getEndDate() != null ? s.getEndDate() : s.getStartDate();
    }
}
