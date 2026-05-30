package com.medianet.adminai.entity;

public enum ActionStatus {
    PENDING,    // Claude proposed it; awaiting admin confirmation
    EXECUTED,   // Ran successfully
    FAILED,     // Execution attempted but errored
    REVERTED,   // Admin undid a previously-executed action
    CANCELLED   // Admin declined the proposal
}
