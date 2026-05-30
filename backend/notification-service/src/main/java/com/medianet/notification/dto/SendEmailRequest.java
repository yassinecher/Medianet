package com.medianet.notification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class SendEmailRequest {

    /** Single recipient — use either this or 'to' list */
    @Email
    private String toEmail;

    private String toName;

    /** Multiple recipients for a broadcast */
    private List<String> toEmails;

    @NotBlank
    private String subject;

    @NotBlank
    private String body;

    /** If true, body is treated as HTML; otherwise plain-text */
    private Boolean html = false;
}
