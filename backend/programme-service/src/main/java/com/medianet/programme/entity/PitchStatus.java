package com.medianet.programme.entity;

/** Lifecycle of a porteur's pitch-video submission. */
public enum PitchStatus {
    /** Started but not finalised (no video yet, or still editing). */
    DRAFT,
    /** Video submitted; awaiting / ready for AI analysis. */
    SUBMITTED,
    /** Auto-transcription + video analysis running. */
    PROCESSING,
    /** AI analysis completed — score + advice available. */
    ANALYZED,
    /** Analysis failed (transcription/vision/LLM error). */
    FAILED
}
