package com.medianet.programme.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.programme.dto.LandingBlock;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.security.SecureRandom;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Landing-page block rules: the type registry, validation + sanitizing of block
 * data, default content, and the mapping from the legacy flat fields
 * ({@code heroTitle}, {@code stats}, {@code faqs}, …) onto blocks.
 *
 * <p>The legacy mapping serves two callers: the one-off migration of pages saved
 * before blocks existed, and the admin AI agent, whose {@code update_landing_page}
 * tool still sends flat patches — they update the FIRST block of each type.
 */
@Component
@RequiredArgsConstructor
public class LandingBlocks {

    public static final Set<String> TYPES = Set.of(
            "hero", "stats", "features", "media", "process", "programmes", "testimonials", "faq", "cta");
    public static final Set<String> SITE_THEME_MODES = Set.of("default", "same", "custom");

    static final int MAX_BLOCKS = 60;
    static final int MAX_LIST = 60;
    static final int MAX_STRING = 20_000;

    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_-]{1,40}$");
    private static final Pattern HEX = Pattern.compile("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ObjectMapper mapper;

    // ── Defaults ─────────────────────────────────────────────────────────────

    /** Default page content (fresh install / "Réinitialiser le contenu"). */
    public List<LandingBlock> defaults() {
        try (InputStream in = new ClassPathResource("landing/default-blocks.json").getInputStream()) {
            return mapper.readValue(in, new TypeReference<List<LandingBlock>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("landing/default-blocks.json is missing or invalid", e);
        }
    }

    public String newId() {
        String s = Long.toString(RANDOM.nextLong() & Long.MAX_VALUE, 36);
        return "b" + (s + "00000000").substring(0, 8);
    }

    // ── Validation / sanitizing ──────────────────────────────────────────────

    /**
     * Returns a clean copy of {@code blocks}: known types only, unique valid ids
     * (bad/duplicate ids are regenerated), size limits enforced, and every link
     * or image URL restricted to safe schemes (a {@code javascript:} link would
     * otherwise run on the public site).
     *
     * @throws IllegalArgumentException with a French message the editor can show
     */
    public List<LandingBlock> sanitize(List<LandingBlock> blocks) {
        if (blocks == null) return new ArrayList<>();
        if (blocks.size() > MAX_BLOCKS) {
            throw new IllegalArgumentException("Trop de blocs (maximum " + MAX_BLOCKS + ").");
        }
        Set<String> seen = new HashSet<>();
        List<LandingBlock> out = new ArrayList<>(blocks.size());
        for (LandingBlock b : blocks) {
            if (b == null) continue;
            if (b.getType() == null || !TYPES.contains(b.getType())) {
                throw new IllegalArgumentException("Type de bloc inconnu : " + b.getType());
            }
            String id = b.getId();
            if (id == null || !ID.matcher(id).matches() || !seen.add(id)) {
                id = newId();
                seen.add(id);
            }
            Map<String, Object> data = b.getData() == null ? new LinkedHashMap<>() : cleanMap(b.getData(), 0);
            out.add(LandingBlock.builder()
                    .id(id)
                    .type(b.getType())
                    .visible(b.getVisible() == null || b.getVisible())
                    .data(data)
                    .build());
        }
        return out;
    }

    /** Blank → null, valid hex kept, anything else rejected. */
    public String cleanColor(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (!HEX.matcher(v).matches()) throw new IllegalArgumentException("Couleur invalide : " + value);
        return v;
    }

    public String cleanThemeMode(String value) {
        if (value == null || value.isBlank()) return "default";
        String v = value.trim().toLowerCase();
        if (!SITE_THEME_MODES.contains(v)) throw new IllegalArgumentException("Mode de thème invalide : " + value);
        return v;
    }

    /** Image / logo URL: http(s) or a site-relative path; anything else → null. */
    public String cleanUrl(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        String lower = v.toLowerCase();
        if (lower.startsWith("https://") || lower.startsWith("http://")) return v;
        if (v.startsWith("/") && !v.startsWith("//")) return v;
        return null;
    }

    /** Link target: http(s), mailto:, tel:, site-relative path or #anchor; anything else → "". */
    private String cleanLink(String value) {
        String v = value.trim();
        String lower = v.toLowerCase();
        if (v.isEmpty() || v.startsWith("#") || (v.startsWith("/") && !v.startsWith("//"))
                || lower.startsWith("https://") || lower.startsWith("http://")
                || lower.startsWith("mailto:") || lower.startsWith("tel:")) {
            return v;
        }
        return "";
    }

    private Map<String, Object> cleanMap(Map<String, Object> in, int depth) {
        if (depth > 4) throw new IllegalArgumentException("Structure de bloc trop profonde.");
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : in.entrySet()) {
            out.put(e.getKey(), cleanValue(e.getKey(), e.getValue(), depth));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Object cleanValue(String key, Object v, int depth) {
        if (v instanceof String s) {
            if (s.length() > MAX_STRING) throw new IllegalArgumentException("Texte trop long dans « " + key + " ».");
            if (key.endsWith("Link")) return cleanLink(s);
            if (key.equals("url") || key.endsWith("Url")) return Objects.requireNonNullElse(cleanUrl(s), "");
            return s;
        }
        if (v instanceof Map<?, ?> m) return cleanMap((Map<String, Object>) m, depth + 1);
        if (v instanceof List<?> list) {
            if (list.size() > MAX_LIST) {
                throw new IllegalArgumentException("Trop d'éléments dans « " + key + " » (maximum " + MAX_LIST + ").");
            }
            List<Object> out = new ArrayList<>(list.size());
            for (Object item : list) {
                // "images" may hold plain URL strings
                if (item instanceof String s && key.equals("images")) {
                    String url = cleanUrl(s);
                    if (url != null) out.add(url);
                } else {
                    out.add(cleanValue(key, item, depth + 1));
                }
            }
            return out;
        }
        return v; // numbers, booleans, null
    }

    // ── Legacy flat fields ⇄ blocks ──────────────────────────────────────────

    /**
     * How one legacy section maps onto a block: its type (and media layout), its
     * visibility flag and its field renames (legacy key → block data key).
     */
    private record Spec(String legacyId, String type, String layout, String showKey,
                        Map<String, String> fields, String background) {}

    private static final List<Spec> SPECS = List.of(
            new Spec("hero", "hero", null, "showHero", Map.of(
                    "heroBadge", "badge", "heroTitle", "title", "heroSubtitle", "subtitle",
                    "primaryCtaLabel", "primaryCtaLabel", "primaryCtaLink", "primaryCtaLink",
                    "secondaryCtaLabel", "secondaryCtaLabel", "secondaryCtaLink", "secondaryCtaLink",
                    "heroImageUrl", "", "heroImages", ""), null),
            new Spec("stats", "stats", null, "showStats", Map.of("stats", "items"), "muted"),
            new Spec("features", "features", null, "showFeatures", Map.of("features", "items"), null),
            new Spec("about", "media", "text-image", "showAbout", Map.of(
                    "aboutBadge", "badge", "aboutTitle", "title", "aboutBody", "body", "aboutImageUrl", ""), null),
            new Spec("process", "process", null, "showProcess", Map.of(
                    "processTitle", "title", "processSubtitle", "subtitle", "processSteps", "items"), "muted"),
            new Spec("programmes", "programmes", null, "showProgrammes", Map.of(
                    "programmesTitle", "title", "programmesSubtitle", "subtitle",
                    "programmesLimit", "limit", "programmesImages", "images"), "muted"),
            new Spec("testimonials", "testimonials", null, "showTestimonials", Map.of(
                    "testimonialsTitle", "title", "testimonials", "items"), null),
            new Spec("faq", "faq", null, "showFaq", Map.of("faqTitle", "title", "faqs", "items"), "muted"),
            new Spec("cta", "cta", null, "showCta", Map.of(
                    "ctaTitle", "title", "ctaSubtitle", "subtitle",
                    "ctaButtonLabel", "buttonLabel", "ctaButtonLink", "buttonLink"), "dark")
    );

    private static final String DEFAULT_ORDER = "hero,stats,features,about,process,programmes,testimonials,faq,cta";

    /** True when {@code patch} contains at least one legacy landing field. */
    public boolean hasLegacyFields(Map<String, Object> patch) {
        return SPECS.stream().anyMatch(s -> patch.containsKey(s.showKey())
                || s.fields().keySet().stream().anyMatch(patch::containsKey));
    }

    /**
     * Apply a legacy flat patch: each section's fields go to the FIRST block of
     * that type (created — hero on top, others before the final CTA — if the
     * page has none).
     */
    public void applyLegacyPatch(List<LandingBlock> blocks, Map<String, Object> patch) {
        for (Spec spec : SPECS) {
            boolean touches = patch.containsKey(spec.showKey())
                    || spec.fields().keySet().stream().anyMatch(patch::containsKey);
            if (!touches) continue;
            LandingBlock target = blocks.stream().filter(b -> matches(spec, b)).findFirst().orElse(null);
            if (target == null) {
                target = newBlock(spec);
                insert(blocks, target);
            }
            fill(spec, target, patch);
            if (patch.get(spec.showKey()) instanceof Boolean show) target.setVisible(show);
        }
    }

    /**
     * Build blocks from a legacy page document (see {@code LegacyLandingMigration}):
     * sections in their saved order, hidden ones kept but hidden, empty ones
     * dropped; old custom sections become "media" blocks.
     */
    @SuppressWarnings("unchecked")
    public List<LandingBlock> fromLegacy(Map<String, Object> legacy) {
        List<String> order = new ArrayList<>();
        Object so = legacy.get("sectionOrder");
        for (String id : (so instanceof String s && !s.isBlank() ? s : DEFAULT_ORDER).split(",")) {
            if (!id.isBlank() && !order.contains(id.trim())) order.add(id.trim());
        }
        for (String id : DEFAULT_ORDER.split(",")) if (!order.contains(id)) order.add(id);

        Map<String, Map<String, Object>> custom = new LinkedHashMap<>();
        if (legacy.get("customSections") instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m && m.get("id") != null) custom.put(String.valueOf(m.get("id")), (Map<String, Object>) m);
            }
        }
        for (String id : custom.keySet()) if (!order.contains("custom:" + id)) order.add("custom:" + id);

        List<LandingBlock> out = new ArrayList<>();
        for (String id : order) {
            if (id.startsWith("custom:")) {
                Map<String, Object> cs = custom.get(id.substring(7));
                if (cs == null) continue;
                Map<String, Object> data = new LinkedHashMap<>(cs);
                data.remove("id");
                Object visible = data.remove("visible");
                data.putIfAbsent("layout", "text-image");
                out.add(LandingBlock.builder().id(newId()).type("media")
                        .visible(!Boolean.FALSE.equals(visible)).data(data).build());
                continue;
            }
            Spec spec = SPECS.stream().filter(s -> s.legacyId().equals(id)).findFirst().orElse(null);
            if (spec == null) continue;
            boolean always = Set.of("hero", "programmes", "cta").contains(spec.type());
            boolean hasContent = spec.fields().keySet().stream().anyMatch(k -> notEmpty(legacy.get(k)));
            if (!always && !hasContent) continue;
            LandingBlock b = newBlock(spec);
            fill(spec, b, legacy);
            // Headings the old page rendered as fallbacks when nothing was saved
            // (hardcoded for features); blocks store them explicitly.
            switch (spec.type()) {
                case "features" -> {
                    b.getData().putIfAbsent("title", "Tout ce dont vous avez besoin");
                    b.getData().putIfAbsent("subtitle", "Un écosystème complet pour chaque acteur de l'incubation");
                }
                case "programmes" -> {
                    b.getData().putIfAbsent("title", "Programmes ouverts");
                    b.getData().putIfAbsent("subtitle", "Candidatez dès maintenant");
                }
                case "testimonials" -> b.getData().putIfAbsent("title", "Ils nous font confiance");
                case "faq" -> b.getData().putIfAbsent("title", "Questions fréquentes");
                default -> { }
            }
            b.setVisible(!Boolean.FALSE.equals(legacy.get(spec.showKey())));
            out.add(b);
        }
        return out;
    }

    private boolean matches(Spec spec, LandingBlock b) {
        if (!spec.type().equals(b.getType())) return false;
        if (spec.layout() == null) return true;
        Object layout = b.getData() == null ? null : b.getData().get("layout");
        return layout == null || spec.layout().equals(layout);
    }

    private LandingBlock newBlock(Spec spec) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (spec.layout() != null) data.put("layout", spec.layout());
        if (spec.background() != null) data.put("background", spec.background());
        return LandingBlock.builder().id(newId()).type(spec.type()).visible(true).data(data).build();
    }

    /** Hero on top, everything else just before the last CTA (or at the end). */
    private void insert(List<LandingBlock> blocks, LandingBlock b) {
        if ("hero".equals(b.getType())) { blocks.add(0, b); return; }
        int cta = -1;
        for (int i = blocks.size() - 1; i >= 0; i--) if ("cta".equals(blocks.get(i).getType())) { cta = i; break; }
        if (cta >= 0 && !"cta".equals(b.getType())) blocks.add(cta, b); else blocks.add(b);
    }

    @SuppressWarnings("unchecked")
    private void fill(Spec spec, LandingBlock b, Map<String, Object> src) {
        Map<String, Object> data = b.getData() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(b.getData());
        spec.fields().forEach((legacyKey, dataKey) -> {
            if (!dataKey.isEmpty() && src.containsKey(legacyKey)) data.put(dataKey, src.get(legacyKey));
        });
        // Images: the old model had one main image (+ extra hero photos).
        if ("hero".equals(spec.type()) && (src.containsKey("heroImageUrl") || src.containsKey("heroImages"))) {
            List<Object> current = data.get("images") instanceof List<?> l ? new ArrayList<>(l) : new ArrayList<>();
            Object first = src.containsKey("heroImageUrl") ? src.get("heroImageUrl") : (current.isEmpty() ? null : current.get(0));
            List<Object> rest = src.get("heroImages") instanceof List<?> extra ? new ArrayList<>(extra)
                    : (current.size() > 1 ? current.subList(1, current.size()) : new ArrayList<>());
            List<Object> images = new ArrayList<>();
            if (notEmpty(first)) images.add(first);
            images.addAll(rest);
            data.put("images", images);
        }
        if ("about".equals(spec.legacyId()) && src.containsKey("aboutImageUrl")) {
            List<Object> images = data.get("images") instanceof List<?> l ? new ArrayList<>(l) : new ArrayList<>();
            Object url = src.get("aboutImageUrl");
            if (!images.isEmpty()) images.remove(0);
            if (notEmpty(url)) images.add(0, new LinkedHashMap<>(Map.of("url", url)));
            data.put("images", images);
        }
        b.setData(data);
    }

    private static boolean notEmpty(Object v) {
        if (v == null) return false;
        if (v instanceof String s) return !s.isBlank();
        if (v instanceof Collection<?> c) return !c.isEmpty();
        return true;
    }
}
