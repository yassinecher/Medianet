package com.medianet.adminai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Structured clarification request produced by the AI when an admin's prompt
 * is ambiguous. The frontend renders this as clickable chips/checkboxes; the
 * admin's selection becomes their next message.
 *
 * <p>Example: admin says "envoie un email aux candidats". Médi doesn't know
 * WHICH candidats, so she returns a Clarification with options like
 * "Candidats acceptés", "Candidats en évaluation", "Candidats refusés".
 */
@Data
@Builder
public class Clarification {
    /** Plain-language question to display above the options. */
    private String question;

    /** 2-6 options. Admin picks one (radio) or several (checkboxes). */
    private List<Option> options;

    /** True = checkboxes (multi-select), false = radio buttons (single choice). */
    private boolean multiSelect;

    @Data
    @Builder
    public static class Option {
        /** Short clickable label. */
        private String label;
        /** Optional one-line description. */
        private String description;
    }
}
