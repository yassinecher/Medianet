package com.medianet.programme.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Layout of a programme's public page (« Page publique » builder): hero options
 * + an ordered list of typed blocks. The front-office renders it; the content of
 * the "bound" blocks (description, objectives, gallery…) stays in the
 * programme's own columns, so this JSON only holds order, visibility, titles and
 * the free sections (FAQ, testimonials, video…).
 *
 * <p>Only the envelope is checked here: React escapes all text and the
 * front-office whitelists link protocols and video hosts when rendering.
 */
final class ProgrammePageJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_CHARS  = 200_000;
    private static final int MAX_BLOCKS = 60;

    private ProgrammePageJson() {}

    /** Compact, validated JSON; null when blank (= default layout). */
    static String normalize(String json) {
        if (json == null || json.isBlank()) return null;
        if (json.length() > MAX_CHARS) throw new IllegalArgumentException("Page trop volumineuse.");
        JsonNode root;
        try {
            root = MAPPER.readTree(json);
        } catch (Exception e) {
            throw new IllegalArgumentException("Mise en page invalide (JSON).");
        }
        if (root == null || !root.isObject() || !root.path("blocks").isArray()) {
            throw new IllegalArgumentException("Mise en page invalide : liste de blocs manquante.");
        }
        if (root.path("blocks").size() > MAX_BLOCKS) {
            throw new IllegalArgumentException("Trop de blocs (maximum " + MAX_BLOCKS + ").");
        }
        for (JsonNode b : root.path("blocks")) {
            if (!b.isObject() || !b.path("id").isTextual() || !b.path("type").isTextual()) {
                throw new IllegalArgumentException("Mise en page invalide : bloc sans identifiant ou type.");
            }
        }
        return root.toString();
    }
}
