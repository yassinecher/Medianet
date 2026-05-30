package com.medianet.notification.entity;

public enum InvitationStatus {
    PENDING,    // Created but not yet sent
    SENT,       // Email dispatched successfully
    FAILED,     // Email dispatch failed
    ACCEPTED,   // Recipient clicked Accept
    DECLINED    // Recipient clicked Decline
}
