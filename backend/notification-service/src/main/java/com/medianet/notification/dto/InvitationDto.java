package com.medianet.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationDto {
    private Long id;
    private String token;
    private String type;
    private String status;
    private Long programmeId;
    private String programmeName;
    private Long phaseId;
    private String phaseName;
    private String recipientEmail;
    private String recipientName;
    private String subject;
    private String message;
    private Boolean requiresRsvp;
    private Long sentByAdminId;
    private String sentByAdminName;
    private LocalDateTime sentAt;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
