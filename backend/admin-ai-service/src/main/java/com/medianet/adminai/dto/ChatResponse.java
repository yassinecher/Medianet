package com.medianet.adminai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ChatResponse {
    private Long conversationId;
    /** Plain text reply from the assistant (concatenated text blocks). */
    private String text;
    /** Action ids the AI proposed in this turn that need admin confirmation. */
    private List<Long> pendingActionIds;
    /**
     * Short follow-up prompts the admin can click to continue the conversation.
     * Generated heuristically from the current turn — quick chips like "Voir les détails",
     * "Confirmer tout", "Trouver d'autres photos".
     */
    private List<String> suggestions;

    /**
     * When non-null, the AI is asking the admin to pick between options before
     * continuing. The UI renders a checkbox/radio picker; the admin's choice
     * becomes the next user message.
     */
    private Clarification clarification;

    /**
     * When non-null, the AI proposed a full multi-step plan. The UI renders
     * a wizard with all steps editable + an "Apply all" button — no per-step
     * confirmation needed.
     */
    private ActionPlan plan;
}
