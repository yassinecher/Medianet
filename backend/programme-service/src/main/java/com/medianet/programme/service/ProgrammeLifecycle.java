package com.medianet.programme.service;

import com.medianet.programme.entity.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Derives a {@link ProgrammeStatus} from the current set of sessions
 * (a.k.a. phases) and their statuses. The rules are intentionally simple
 * and forgiving — they nudge the programme forward, never lock it back.
 *
 * <p>Rules (evaluated top-to-bottom; first match wins):
 *
 * <ol>
 *   <li>No sessions yet → keep current status (default {@code DRAFT}).</li>
 *   <li>Any session ACTIVE of type CANDIDATURE_SUBMISSION → {@code OPEN}.</li>
 *   <li>Any session ACTIVE of type PRESELECTION or PITCH_DAY → {@code EVALUATION}.</li>
 *   <li>Any session ACTIVE of type ONBOARDING / INCUBATION / TRAINING_DAY → {@code IN_PROGRESS}.</li>
 *   <li>Any session ACTIVE of type DEMO_DAY → {@code IN_PROGRESS} (final stretch).</li>
 *   <li>All sessions COMPLETED and at least one DEMO_DAY exists → {@code CLOSED}.</li>
 *   <li>All sessions COMPLETED → {@code CLOSED}.</li>
 *   <li>Otherwise keep the current status.</li>
 * </ol>
 *
 * <p>If the programme was manually moved to {@code CANCELLED} we never override
 * it from session activity.
 */
@Component
@Slf4j
public class ProgrammeLifecycle {

    /**
     * Inspect the programme's sessions and update {@link Programme#setStatus}
     * if a transition is implied. Returns true if the status was changed.
     */
    public boolean recompute(Programme p) {
        if (p == null) return false;
        if (p.getStatus() == ProgrammeStatus.CANCELLED) return false;

        List<ProgrammePhase> sessions = p.getPhases();
        if (sessions == null || sessions.isEmpty()) return false;

        ProgrammeStatus target = p.getStatus();

        boolean candidatureActive = sessions.stream().anyMatch(s ->
                s.getStatus() == PhaseStatus.ACTIVE && s.getSessionType() == SessionType.CANDIDATURE_SUBMISSION);
        boolean evalActive = sessions.stream().anyMatch(s ->
                s.getStatus() == PhaseStatus.ACTIVE
                && (s.getSessionType() == SessionType.PRESELECTION
                    || s.getSessionType() == SessionType.PITCH_DAY));
        boolean runActive = sessions.stream().anyMatch(s ->
                s.getStatus() == PhaseStatus.ACTIVE
                && (s.getSessionType() == SessionType.ONBOARDING
                    || s.getSessionType() == SessionType.INCUBATION
                    || s.getSessionType() == SessionType.TRAINING_DAY
                    || s.getSessionType() == SessionType.DEMO_DAY));

        boolean allCompleted = sessions.stream().allMatch(s -> s.getStatus() == PhaseStatus.COMPLETED);

        if (candidatureActive)      target = ProgrammeStatus.OPEN;
        else if (evalActive)        target = ProgrammeStatus.EVALUATION;
        else if (runActive)         target = ProgrammeStatus.IN_PROGRESS;
        else if (allCompleted)      target = ProgrammeStatus.CLOSED;

        if (target != p.getStatus()) {
            log.info("Programme {} status {} → {} (driven by session progression)",
                    p.getId(), p.getStatus(), target);
            p.setStatus(target);
            return true;
        }
        return false;
    }
}
