package com.medianet.adminai.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Structured multi-step plan the AI proposes upfront so the admin reviews +
 * tweaks all decisions in ONE form instead of clicking Confirm on each
 * pending-action card. Submitted to /api/admin-ai/plan/execute as a batch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionPlan {
    /** Short title displayed at the top of the wizard. */
    private String title;
    /** Optional 1-2 sentence summary of what the plan will do. */
    private String summary;
    /** Ordered list of steps. */
    private List<Step> steps;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step {
        /** Short human label, e.g. "Créer le programme FoodTech 2026". */
        private String label;
        /** Tool name to call (must match a registered tool). */
        private String tool;
        /** Args to pass to the tool. The admin may edit these in the wizard. */
        private Map<String, Object> args;
        /** Whether the admin can uncheck this step (true = optional). */
        @Builder.Default
        private boolean optional = false;
        /**
         * If this step references the entity created by an earlier step, name
         * the field that should be back-filled with that id. E.g. when a phase
         * step depends on the programme created by a previous step:
         *   { dependsOnStep: 0, fillField: "programmeId" }
         * The server will replace args[fillField] with the real id at execute time.
         */
        private Integer dependsOnStep;
        private String  fillField;
    }
}
