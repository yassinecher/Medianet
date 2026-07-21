package com.medianet.programme.entity;

public enum TaskStatus {
    PENDING,
    IN_PROGRESS,
    /** The assignee submitted their deliverable (rendu) and it awaits admin review. */
    SUBMITTED,
    COMPLETED,
    CANCELLED
}
