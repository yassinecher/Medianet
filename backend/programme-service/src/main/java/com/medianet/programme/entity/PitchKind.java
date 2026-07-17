package com.medianet.programme.entity;

/** Whether a pitch submission is a practice run or the real presentation. */
public enum PitchKind {
    /** Practice pitch — a porteur may upload several to improve over time. */
    TRAINING,
    /** The real / final pitch — one per porteur per session. */
    FINAL
}
