package com.medianet.notification.dto;

import lombok.Data;

import java.util.List;

/**
 * Sends a session announcement to its participants with a DIFFERENT email per
 * recipient type (jury / porteur / member / organisateur / invité). Each
 * recipient is recorded as an {@code Invitation} row so the send is archived
 * (status SENT / FAILED) and visible in the programme's communications log.
 */
@Data
public class SessionNotifyRequest {

    private Long   programmeId;
    private String programmeName;
    private Long   phaseId;
    private String phaseName;

    /** One block per recipient type, carrying that type's tailored email. */
    private List<Item> items;

    @Data
    public static class Item {
        /** jury | porteur | member | organisateur | invite */
        private String type;
        private String subject;
        /** Full HTML body (built by the frontend, incl. the Google Agenda link). */
        private String body;
        private List<Recipient> recipients;
    }

    @Data
    public static class Recipient {
        private String email;
        private String name;
    }
}
