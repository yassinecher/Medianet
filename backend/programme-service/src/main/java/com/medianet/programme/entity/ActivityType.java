package com.medianet.programme.entity;

/**
 * Granular type of one item inside a {@link SessionDay}.
 *
 * <p>{@code TRAINING_STEP} is the marker used inside a {@code TRAINING_DAY}
 * session — the whole training agenda is built from these.
 */
public enum ActivityType {
    ACTIVITY,
    TRAINING_STEP,
    KEYNOTE,
    WORKSHOP,
    PANEL,
    PITCH,
    BREAK,
    NETWORKING,
    OTHER
}
