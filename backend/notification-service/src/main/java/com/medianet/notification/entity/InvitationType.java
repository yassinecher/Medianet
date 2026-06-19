package com.medianet.notification.entity;

public enum InvitationType {
    JURY,         // Invited to evaluate candidatures in a programme/phase
    PORTEUR,      // Startup founder invited to apply to a programme
    MEMBER,       // Member of a startup's organisation
    ORGANISATEUR, // Person running/responsible for a session
    MENTOR,       // Mentor invited to a phase
    GUEST,        // Observer / partner / external guest
    GENERAL       // Generic announcement (no RSVP needed)
}
