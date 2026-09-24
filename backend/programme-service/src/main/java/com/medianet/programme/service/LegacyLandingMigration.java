package com.medianet.programme.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Reads a landing page saved by the pre-blocks model (one column per field +
 * the landing_stats / landing_features / landing_process_steps /
 * landing_testimonials / landing_faqs tables) and returns it as the old flat
 * document ({@code heroTitle}, {@code stats}, {@code sectionOrder}, …), which
 * {@link LandingBlocks#fromLegacy} turns into blocks.
 *
 * <p>Plain JDBC on purpose: those columns are no longer mapped by JPA. Nothing is
 * modified or dropped — the old data stays in place as a backup. Every column is
 * read defensively (older databases may lack the most recent ones).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LegacyLandingMigration {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    /** Legacy column (snake_case) → legacy document key. */
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    static {
        for (String key : List.of(
                "heroTitle", "heroSubtitle", "heroBadge", "heroImageUrl",
                "primaryCtaLabel", "primaryCtaLink", "secondaryCtaLabel", "secondaryCtaLink",
                "aboutBadge", "aboutTitle", "aboutBody", "aboutImageUrl",
                "processTitle", "processSubtitle", "testimonialsTitle", "faqTitle",
                "programmesTitle", "programmesSubtitle", "programmesLimit",
                "ctaTitle", "ctaSubtitle", "ctaButtonLabel", "ctaButtonLink",
                "showHero", "showStats", "showAbout", "showFeatures", "showProcess",
                "showTestimonials", "showFaq", "showCta", "showProgrammes", "sectionOrder")) {
            COLUMNS.put(key.replaceAll("([A-Z])", "_$1").toLowerCase(), key);
        }
    }

    /** The old page document, or null when the database has no pre-blocks page. */
    public Map<String, Object> read() {
        Map<String, Object> row;
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM landing_page WHERE id = 1");
            if (rows.isEmpty()) return null;
            row = rows.get(0); // case-insensitive keys
        } catch (DataAccessException e) {
            return null;
        }
        if (!row.containsKey("hero_title")) return null; // schema created by the blocks model

        Map<String, Object> doc = new LinkedHashMap<>();
        COLUMNS.forEach((column, key) -> {
            if (row.get(column) != null) doc.put(key, row.get(column));
        });
        putJson(doc, "heroImages", row.get("hero_images_json"));
        putJson(doc, "programmesImages", row.get("programmes_images_json"));
        putJson(doc, "customSections", row.get("custom_sections_json"));

        doc.put("stats", list("landing_stats", "stat_order", Map.of(
                "stat_label", "label", "stat_value", "value", "stat_suffix", "suffix")));
        doc.put("features", list("landing_features", "feature_order", Map.of(
                "feature_title", "title", "feature_description", "description",
                "feature_icon", "icon", "feature_image_url", "imageUrl")));
        doc.put("processSteps", list("landing_process_steps", "step_order", Map.of(
                "step_title", "title", "step_description", "description",
                "step_icon", "icon", "step_image_url", "imageUrl")));
        doc.put("testimonials", list("landing_testimonials", "testimonial_order", Map.of(
                "testimonial_quote", "quote", "testimonial_author_name", "authorName",
                "testimonial_author_role", "authorRole", "testimonial_photo_url", "photoUrl")));
        doc.put("faqs", list("landing_faqs", "faq_order", Map.of(
                "faq_question", "question", "faq_answer", "answer")));
        log.info("Migrating the legacy landing page to blocks");
        return doc;
    }

    /** Rows of a legacy element-collection table, in their saved order; [] if absent. */
    private List<Map<String, Object>> list(String table, String orderColumn, Map<String, String> columns) {
        try {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT * FROM " + table + " WHERE landing_id = 1 ORDER BY " + orderColumn)) {
                Map<String, Object> item = new LinkedHashMap<>();
                columns.forEach((column, key) -> {
                    if (r.get(column) != null) item.put(key, r.get(column));
                });
                out.add(item);
            }
            return out;
        } catch (DataAccessException e) {
            return new ArrayList<>();
        }
    }

    private void putJson(Map<String, Object> doc, String key, Object json) {
        if (!(json instanceof String s) || s.isBlank()) return;
        try {
            doc.put(key, mapper.readValue(s, new TypeReference<List<Object>>() {}));
        } catch (Exception e) {
            log.warn("Ignoring unreadable legacy landing column {}: {}", key, e.getMessage());
        }
    }
}
