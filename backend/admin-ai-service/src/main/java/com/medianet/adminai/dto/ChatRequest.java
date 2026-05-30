package com.medianet.adminai.dto;

import lombok.Data;

@Data
public class ChatRequest {
    /** Existing conversation to continue, or null to start a new one. */
    private Long conversationId;
    /** The admin's free-text message. */
    private String message;
}
