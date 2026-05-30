package com.medianet.notification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateInvitationRequest {

    @NotNull
    private String type;           // JURY | PORTEUR | MENTOR | GUEST | GENERAL

    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;

    @NotBlank
    @Email
    private String recipientEmail;

    private String recipientName;

    @NotBlank
    private String subject;

    @NotBlank
    private String message;

    /** Whether to embed Accept/Decline links in the email */
    private Boolean requiresRsvp = false;
}
