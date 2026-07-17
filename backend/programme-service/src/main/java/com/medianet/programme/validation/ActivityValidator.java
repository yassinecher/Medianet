package com.medianet.programme.validation;

import com.medianet.programme.entity.ProgrammePhase;
import com.medianet.programme.validation.ValidationException.ValidationCode;
import org.springframework.stereotype.Component;

import java.time.LocalTime;

/**
 * Centralised activity-level validation: a session must allow activities, and
 * each activity's time range must be coherent (and within its session/day).
 */
@Component
public class ActivityValidator {

    /** The owning session must permit an activity agenda. */
    public void validateSessionConstraints(ProgrammePhase session) {
        if (session != null && Boolean.FALSE.equals(session.getAllowActivities())) {
            throw new ValidationException(ValidationCode.ACTIVITY_NOT_ALLOWED,
                    "Cette session n'autorise pas d'activités (ex. session de candidature).");
        }
    }

    /** startTime &lt; endTime when both are set. */
    public void validateActivityTimeRange(LocalTime start, LocalTime end) {
        if (start != null && end != null && !start.isBefore(end)) {
            throw new ValidationException(ValidationCode.ACTIVITY_OUT_OF_SESSION_RANGE,
                    "L'heure de début de l'activité doit précéder l'heure de fin.");
        }
    }
}
