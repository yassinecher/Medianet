package com.medianet.programme.validation;

import com.medianet.programme.entity.Programme;
import com.medianet.programme.entity.ProgrammePhase;
import com.medianet.programme.validation.ValidationException.ValidationCode;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Centralised session-level validation. Keeps date / overlap / visibility rules
 * in one place so every create/update path enforces them identically.
 */
@Component
public class SessionValidator {

    /** Run every session rule. {@code siblings} = other phases of the same programme. */
    public void validate(ProgrammePhase phase, Programme programme, List<ProgrammePhase> siblings) {
        validateDateRange(phase, programme);
        validateOverlap(phase, siblings);
    }

    /** startDate ≤ endDate, and the session must sit within the programme window. */
    public void validateDateRange(ProgrammePhase phase, Programme programme) {
        LocalDate start = phase.getStartDate();
        LocalDate end   = phase.getEndDate() != null ? phase.getEndDate() : start;
        if (start != null && end != null && start.isAfter(end)) {
            throw new ValidationException(ValidationCode.SESSION_DATE_INVALID,
                    "La date de début doit précéder la date de fin.");
        }
        // The candidature-intake window legitimately runs BEFORE the programme
        // proper (you collect applications, then the cohort starts). It also
        // defines the « clôture des candidatures », so it must be allowed to sit
        // ahead of the programme start — every other session type still can't.
        boolean isIntake = phase.getSessionType() == com.medianet.programme.entity.SessionType.CANDIDATURE_SUBMISSION;
        if (programme != null && start != null) {
            if (!isIntake && programme.getStartDate() != null && start.isBefore(programme.getStartDate())) {
                throw new ValidationException(ValidationCode.PROGRAM_DATE_CONFLICT,
                        "La session commence avant le début du programme.");
            }
            if (!isIntake && programme.getEndDate() != null && end != null && end.isAfter(programme.getEndDate())) {
                throw new ValidationException(ValidationCode.PROGRAM_DATE_CONFLICT,
                        "La session se termine après la fin du programme.");
            }
        }
    }

    /**
     * Sessions in the same lane must not overlap in time unless either side
     * carries {@code allowOverlap}. Nested day-sessions (inside a range) are
     * excluded — they intentionally fall within their parent.
     */
    public void validateOverlap(ProgrammePhase phase, List<ProgrammePhase> siblings) {
        if (Boolean.TRUE.equals(phase.getAllowOverlap())) return;
        if (phase.getStartDate() == null || siblings == null) return;
        LocalDate aStart = phase.getStartDate();
        LocalDate aEnd   = phase.getEndDate() != null ? phase.getEndDate() : aStart;
        String lane = phase.getLane();

        for (ProgrammePhase other : siblings) {
            if (other.getId() != null && other.getId().equals(phase.getId())) continue;
            if (Boolean.TRUE.equals(other.getAllowOverlap())) continue;
            // Only compare peers at the same nesting level + same lane.
            if (!sameParent(phase, other)) continue;
            if (!java.util.Objects.equals(lane, other.getLane())) continue;
            if (other.getStartDate() == null) continue;
            LocalDate bStart = other.getStartDate();
            LocalDate bEnd   = other.getEndDate() != null ? other.getEndDate() : bStart;
            // True overlap (boundary-touching, end == next start, is allowed).
            // Single-day sessions land on the same day → flagged when equal.
            boolean sameSingleDay = aStart.equals(aEnd) && bStart.equals(bEnd) && aStart.equals(bStart);
            boolean rangesCross   = aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
            if (sameSingleDay || rangesCross) {
                throw new ValidationException(ValidationCode.SESSION_OVERLAP_DETECTED,
                        "Cette session chevauche « " + other.getTitle() + " » sur la même voie. "
                        + "Activez le chevauchement parallèle ou ajustez les dates.");
            }
        }
    }

    private boolean sameParent(ProgrammePhase a, ProgrammePhase b) {
        return java.util.Objects.equals(a.getParentSessionId(), b.getParentSessionId());
    }
}
