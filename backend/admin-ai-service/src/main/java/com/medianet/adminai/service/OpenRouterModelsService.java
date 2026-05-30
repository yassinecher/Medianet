package com.medianet.adminai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Provider-aware model catalog.
 *
 * <p>For <b>HuggingFace</b>: hits the HF Hub API and lists models exposed by Inference Providers.
 * <p>For <b>CUSTOM</b>: tries <code>{baseUrl}/models</code> on the configured endpoint, falling back to the HF list.
 *
 * <p>Each entry returned to the UI has the same enriched shape regardless of provider so
 * the frontend code doesn't need to branch.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpenRouterModelsService {

    private final AiSettingsService settings;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Cache by provider id (different providers have different catalogs). */
    private final Map<String, List<Map<String, Object>>> cacheByProvider = new HashMap<>();
    private final Map<String, Instant> cachedAtByProvider = new HashMap<>();
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    public synchronized List<Map<String, Object>> listAll(boolean forceRefresh) {
        String provider = settings.resolveProvider();
        List<Map<String, Object>> cache = cacheByProvider.get(provider);
        Instant cachedAt = cachedAtByProvider.get(provider);
        if (!forceRefresh && cache != null && cachedAt != null
                && Duration.between(cachedAt, Instant.now()).compareTo(CACHE_TTL) < 0) {
            return cache;
        }

        List<Map<String, Object>> enriched = switch (provider) {
            case "HUGGINGFACE" -> fetchHuggingFace();
            // CUSTOM (OpenAI-compatible) — try /v1/models if the endpoint supports it,
            // otherwise return the HF fallback list so the UI still has something.
            default -> fetchOpenAiCompatibleOrFallback();
        };

        cacheByProvider.put(provider, enriched);
        cachedAtByProvider.put(provider, Instant.now());
        return enriched;
    }

    public Map<String, Object> search(SearchCriteria c) {
        List<Map<String, Object>> all = listAll(false);
        List<Map<String, Object>> filtered = all.stream()
                .filter(m -> c.query == null || c.query.isBlank()
                        || lowerString(m.get("name")).contains(c.query.toLowerCase())
                        || lowerString(m.get("id")).contains(c.query.toLowerCase())
                        || lowerString(m.get("description")).contains(c.query.toLowerCase()))
                .filter(m -> !c.freeOnly || Boolean.TRUE.equals(m.get("isFree")))
                .filter(m -> !c.toolsOnly || Boolean.TRUE.equals(m.get("supportsTools")))
                .filter(m -> !c.visionOnly || Boolean.TRUE.equals(m.get("supportsVision")))
                .filter(m -> c.provider == null || c.provider.isBlank()
                        || c.provider.equalsIgnoreCase((String) m.get("provider")))
                .filter(m -> c.minContext == null
                        || asInt(m.get("context_length")) >= c.minContext)
                .collect(Collectors.toList());

        filtered.sort((a, b) -> {
            boolean fa = Boolean.TRUE.equals(a.get("isFree"));
            boolean fb = Boolean.TRUE.equals(b.get("isFree"));
            if (fa != fb) return fa ? -1 : 1;
            return Integer.compare(asInt(b.get("context_length")), asInt(a.get("context_length")));
        });

        Map<String, Long> providers = all.stream()
                .map(m -> (String) m.get("provider"))
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(p -> p, Collectors.counting()));
        long freeCount   = all.stream().filter(m -> Boolean.TRUE.equals(m.get("isFree"))).count();
        long toolsCount  = all.stream().filter(m -> Boolean.TRUE.equals(m.get("supportsTools"))).count();
        long visionCount = all.stream().filter(m -> Boolean.TRUE.equals(m.get("supportsVision"))).count();

        return Map.of(
            "backend",   settings.resolveProvider(),
            "items",     filtered,
            "total",     all.size(),
            "matched",   filtered.size(),
            "facets",    Map.of(
                "providers",   providers,
                "freeCount",   freeCount,
                "toolsCount",  toolsCount,
                "visionCount", visionCount
            ),
            "cachedAt", cachedAtByProvider.getOrDefault(settings.resolveProvider(), Instant.now()).toString()
        );
    }

    public Map<String, Object> getOne(String modelId) {
        return listAll(false).stream()
                .filter(m -> modelId.equals(m.get("id")))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Modèle introuvable: " + modelId));
    }

    /**
     * Best-effort fetch of an OpenAI-compatible /v1/models endpoint for CUSTOM providers.
     * If the endpoint doesn't exist or returns nothing useful, fall back to the curated
     * HuggingFace list so the admin always has something to pick.
     */
    private List<Map<String, Object>> fetchOpenAiCompatibleOrFallback() {
        String baseUrl = settings.resolveBaseUrl();
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/models"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + (settings.resolveApiKey() != null ? settings.resolveApiKey() : ""))
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 400) return fallbackHuggingFaceList();
            Map<String, Object> body = json.readValue(resp.body(), new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");
            if (data == null || data.isEmpty()) return fallbackHuggingFaceList();
            // Light enrichment: id/name/provider only
            return data.stream().map(raw -> {
                String id = (String) raw.get("id");
                Map<String, Object> out = new LinkedHashMap<>(raw);
                out.put("name", id);
                out.put("provider", id != null && id.contains("/") ? id.substring(0, id.indexOf('/')) : "custom");
                out.put("isFree", true);
                out.put("supportsTools", false);
                out.put("supportsVision", false);
                return out;
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Custom /v1/models fetch failed, falling back to HF list: {}", e.getMessage());
            return fallbackHuggingFaceList();
        }
    }

    // ── HuggingFace ───────────────────────────────────────────────────────────

    /**
     * Fetch the HuggingFace Inference Providers catalog.
     *
     * <p>We hit <code>https://huggingface.co/api/models?inference_provider=…&pipeline_tag=text-generation</code>
     * which returns models served by HF's Inference Providers (Together, Fireworks, Replicate, etc.).
     * No auth required for browsing; auth only needed for actually calling them.
     */
    private List<Map<String, Object>> fetchHuggingFace() {
        try {
            // Curated, known-warm chat models with tool support (HF catalog has thousands —
            // we filter to the practical ones for an agent use case).
            String url = "https://huggingface.co/api/models" +
                    "?inference_provider=all" +
                    "&pipeline_tag=text-generation" +
                    "&filter=conversational" +
                    "&sort=trendingScore" +
                    "&limit=200" +
                    "&full=true" +
                    "&config=true";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 400) {
                throw new RuntimeException("HF /api/models " + resp.statusCode() + ": " + resp.body());
            }
            List<Map<String, Object>> data = json.readValue(resp.body(), new TypeReference<>() {});
            // De-duplicate by model id, enrich and filter
            return data.stream()
                    .filter(m -> m.get("id") != null)
                    .map(this::enrichHuggingFace)
                    .filter(m -> m != null)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("HuggingFace catalog fetch failed", e);
            List<Map<String, Object>> stale = cacheByProvider.get("HUGGINGFACE");
            if (stale != null) return stale;
            // Fall back to a small hand-picked list so the UI still works
            return fallbackHuggingFaceList();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> enrichHuggingFace(Map<String, Object> raw) {
        Map<String, Object> out = new LinkedHashMap<>();
        String id = (String) raw.get("id");
        if (id == null) return null;
        out.put("id", id);
        // HF uses "modelId" — keep both for the UI
        out.put("name", prettyHfName(id));

        // description = card "summary" if present, else first sentence of cardData
        String description = null;
        if (raw.get("cardData") instanceof Map<?, ?> cd) {
            Object summary = ((Map<String, Object>) cd).get("summary");
            if (summary instanceof String s) description = s;
        }
        if (description == null && raw.get("description") instanceof String d) description = d;
        out.put("description", description);

        // Author / provider — the part before "/"
        out.put("provider", id.contains("/") ? id.substring(0, id.indexOf('/')) : "unknown");

        // Inference providers list (HF returns a list per model)
        List<String> inferenceProviders = new ArrayList<>();
        if (raw.get("inferenceProviderMapping") instanceof Map<?, ?> ipm) {
            inferenceProviders.addAll(ipm.keySet().stream().map(String::valueOf).toList());
        }
        out.put("inferenceProviders", inferenceProviders);

        // Tags
        List<String> tags = raw.get("tags") instanceof List<?> tl
                ? tl.stream().map(String::valueOf).toList()
                : List.of();
        out.put("tags", tags);

        // Vision support: image-text-to-text pipeline, or "vision" / "image" tag
        boolean supportsVision = tags.contains("image-text-to-text")
                || tags.contains("vision")
                || tags.stream().anyMatch(t -> t.toLowerCase().contains("multimodal"));
        out.put("supportsVision", supportsVision);

        // Tool calling support — conservative whitelist of model families known to do it well.
        // HF Inference Providers tool calling depends on the *provider*, not just the model,
        // but these are the safest bets.
        String idLow = id.toLowerCase();
        boolean supportsTools =
                idLow.contains("llama-3.3")
                || idLow.contains("llama-3.1-70b")
                || idLow.contains("llama-3.1-8b-instruct")
                || idLow.contains("qwen2.5")
                || idLow.contains("qwen3")
                || idLow.contains("mistral-small")
                || idLow.contains("mistral-large")
                || idLow.contains("deepseek-v3")
                || idLow.contains("gpt-oss")
                || tags.contains("function-calling")
                || tags.contains("tool-use");
        out.put("supportsTools", supportsTools);

        // Reliable tool calling = the model actually emits proper OpenAI tool_calls
        // (not text-pretending-to-be-JSON). Smaller models are flaky here.
        boolean reliableTools = supportsTools && (
                idLow.contains("70b") || idLow.contains("72b") || idLow.contains("405b")
                || idLow.contains("mistral-large") || idLow.contains("deepseek-v3")
                || idLow.contains("qwen2.5-72b") || idLow.contains("qwen3-235b"));
        out.put("reliableTools", reliableTools);

        // Context length: try config first, fall back to a reasonable guess
        Integer contextLength = null;
        if (raw.get("config") instanceof Map<?, ?> cfg) {
            Object maxPos = ((Map<String, Object>) cfg).get("max_position_embeddings");
            if (maxPos instanceof Number n) contextLength = n.intValue();
        }
        if (contextLength == null) {
            // Defaults by family
            if (idLow.contains("llama-3"))        contextLength = 131072;
            else if (idLow.contains("qwen2.5"))    contextLength = 32768;
            else if (idLow.contains("mistral"))    contextLength = 32768;
            else if (idLow.contains("deepseek"))   contextLength = 64000;
            else contextLength = 8192;
        }
        out.put("context_length", contextLength);

        // HF Inference Providers exposes free credits up to a monthly quota
        // (currently $0.10/month for unverified accounts, more for Pro).
        // We mark all as "isFree" since the user is on the free credit tier.
        out.put("isFree", true);

        // Downloads + likes — useful sort hints for the UI
        if (raw.get("downloads") instanceof Number n) out.put("downloads", n.longValue());
        if (raw.get("likes")     instanceof Number n) out.put("likes",     n.longValue());

        // Direct link to the model card
        out.put("hfUrl", "https://huggingface.co/" + id);

        // Pricing — HF Inference Providers does charge per token at the provider rate,
        // but on the free credits tier it's effectively zero. We omit pricing fields here.
        return out;
    }

    private String prettyHfName(String id) {
        // "meta-llama/Meta-Llama-3.1-70B-Instruct" -> "Meta Llama 3.1 70B Instruct"
        String tail = id.contains("/") ? id.substring(id.indexOf('/') + 1) : id;
        return tail.replace('-', ' ').replace('_', ' ');
    }

    private List<Map<String, Object>> fallbackHuggingFaceList() {
        return List.of(
            hfFallback("meta-llama/Llama-3.3-70B-Instruct",       131072, true),
            hfFallback("meta-llama/Meta-Llama-3.1-70B-Instruct",  131072, true),
            hfFallback("meta-llama/Meta-Llama-3.1-8B-Instruct",   131072, true),
            hfFallback("Qwen/Qwen2.5-72B-Instruct",                32768, true),
            hfFallback("Qwen/Qwen2.5-Coder-32B-Instruct",          32768, true),
            hfFallback("mistralai/Mistral-Small-3.2-24B-Instruct-2506", 32768, true),
            hfFallback("mistralai/Mistral-7B-Instruct-v0.3",       32768, false),
            hfFallback("deepseek-ai/DeepSeek-V3.1",                64000, true),
            hfFallback("microsoft/Phi-3.5-mini-instruct",         131072, false)
        );
    }

    private Map<String, Object> hfFallback(String id, int ctx, boolean tools) {
        return new LinkedHashMap<>(Map.of(
            "id", id,
            "name", prettyHfName(id),
            "provider", id.substring(0, id.indexOf('/')),
            "description", "Modèle hébergé via HuggingFace Inference Providers.",
            "context_length", ctx,
            "isFree", true,
            "supportsTools", tools,
            "supportsVision", false,
            "tags", List.of(),
            "hfUrl", "https://huggingface.co/" + id
        ));
    }

    // ── Generic helpers ───────────────────────────────────────────────────────

    private static String lowerString(Object o) { return o == null ? "" : o.toString().toLowerCase(); }

    private static int asInt(Object o) {
        if (o instanceof Integer i) return i;
        if (o instanceof Long l)    return l.intValue();
        if (o instanceof Number n)  return n.intValue();
        try { return o == null ? 0 : Integer.parseInt(o.toString()); } catch (Exception e) { return 0; }
    }

    @lombok.Data
    public static class SearchCriteria {
        private String  query;
        private boolean freeOnly;
        private boolean toolsOnly;
        private boolean visionOnly;
        private String  provider;
        private Integer minContext;
    }
}
