package com.medianet.programme.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One block of the landing page. {@code type} selects the renderer (see
 * {@code LandingBlocks.TYPES}); {@code data} holds that type's fields (titles,
 * items, images…) as free JSON so new fields don't need a schema migration.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LandingBlock {
    /** Stable id (letters, digits, - and _), unique within the page. */
    private String id;
    private String type;
    @Builder.Default
    private Boolean visible = true;
    @Builder.Default
    private Map<String, Object> data = new LinkedHashMap<>();
}
