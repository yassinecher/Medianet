package com.medianet.programme.entity;

/**
 * Unified type for every step in a programme's lifecycle.
 *
 * <p>A {@link ProgrammePhase} (kept under that name for DB compatibility) is the
 * single "Session" object — its {@code sessionType} discriminates the kind of
 * work happening: applications, evaluation, kickoff, day-to-day incubation,
 * pitch, demo, or training.
 */
public enum SessionType {
    /** Porteurs submit candidatures. Org selection is required. */
    CANDIDATURE_SUBMISSION,
    /** Jury / admin shortlist candidatures from the pool. */
    PRESELECTION,
    /** Live pitching event in front of jury. */
    PITCH_DAY,
    /** Welcome session for selected startups. */
    ONBOARDING,
    /** Recurring mentoring / coaching during the programme run. */
    INCUBATION,
    /** Final showcase event. */
    DEMO_DAY,
    /** Workshop / formation — same shape, different intent. */
    TRAINING_DAY
}
