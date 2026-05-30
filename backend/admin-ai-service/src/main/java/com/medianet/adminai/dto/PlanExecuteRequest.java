package com.medianet.adminai.dto;

import lombok.Data;

/**
 * Body for POST /api/admin-ai/plan/execute — the admin's (possibly edited)
 * plan plus the conversation id so we can append a result note for the AI's
 * next turn.
 */
@Data
public class PlanExecuteRequest {
    private Long conversationId;
    private ActionPlan plan;
}
