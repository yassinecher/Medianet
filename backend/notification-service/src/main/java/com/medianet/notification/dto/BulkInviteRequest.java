package com.medianet.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class BulkInviteRequest {

    @NotNull
    private String type;           // JURY | PORTEUR | MENTOR | GUEST | GENERAL

    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;
    private Long activityId;
    private String activityName;

    @NotNull
    private String subject;

    @NotNull
    private String message;

    /** Whether to embed Accept/Decline links */
    private Boolean requiresRsvp = false;

    /** List of recipients */
    @NotEmpty
    @Valid
    private List<RecipientItem> recipients;

    @Data
    public static class RecipientItem {
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Email
        private String email;
        private String name;
    }
}
