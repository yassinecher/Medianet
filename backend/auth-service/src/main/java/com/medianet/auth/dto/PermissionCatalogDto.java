package com.medianet.auth.dto;

import lombok.*;

import java.util.List;

/**
 * One module of the grouped permission catalog: human label + description,
 * GENERAL/ADMIN scope, and the permissions it contains. Drives the permission
 * matrices in the back-office.
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PermissionCatalogDto {

    /** Module key = slug prefix (e.g. "programmes"). */
    private String key;
    private String label;
    private String description;
    /** GENERAL (plateforme) | ADMIN (back-office). */
    private String scope;
    private List<Entry> permissions;

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Entry {
        private String slug;
        /** Action part of the slug: read | create | update | delete | evaluate | … */
        private String action;
        private String label;
        /** Per-permission scope (may differ from the module, e.g. candidatures:decide). */
        private String scope;
    }
}
