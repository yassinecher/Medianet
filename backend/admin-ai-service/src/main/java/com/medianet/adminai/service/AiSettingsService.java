package com.medianet.adminai.service;

import com.medianet.adminai.dto.AiSettingsDto;
import com.medianet.adminai.dto.UpdateAiSettingsRequest;
import com.medianet.adminai.entity.AiSettings;
import com.medianet.adminai.repository.AiSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single source of truth for LLM settings.
 *
 * <p>Order of precedence when reading:
 * <ol>
 *   <li>DB row (admin entered via UI)</li>
 *   <li>Env var fallback (HF_TOKEN, LLM_MODEL)</li>
 *   <li>Hard-coded default (free Llama 3.3 70B)</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiSettingsService {

    private static final Long SINGLETON_ID = 1L;
    private static final String DEFAULT_PROVIDER = "HUGGINGFACE";

    /** Provider-specific defaults (base URL + recommended default model). */
    private static final java.util.Map<String, String[]> PROVIDER_DEFAULTS = java.util.Map.of(
        "HUGGINGFACE", new String[] { "https://router.huggingface.co/v1",   "meta-llama/Llama-3.3-70B-Instruct" },
        "CUSTOM",      new String[] { "https://api.openai.com/v1",          "gpt-4o-mini" }
    );

    private static String defaultBaseUrl(String provider) { return PROVIDER_DEFAULTS.getOrDefault(provider, PROVIDER_DEFAULTS.get(DEFAULT_PROVIDER))[0]; }
    private static String defaultModel(String provider)   { return PROVIDER_DEFAULTS.getOrDefault(provider, PROVIDER_DEFAULTS.get(DEFAULT_PROVIDER))[1]; }

    private final AiSettingsRepository repo;

    // Env-var fallbacks. Empty defaults — the DB row is the source of truth.
    @Value("${llm.api-key:${HF_TOKEN:}}")        private String envApiKey;
    @Value("${llm.model:}")                      private String envModel;
    @Value("${llm.base-url:}")                   private String envBaseUrl;

    // ── Read (used by the LLM client) ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public String resolveProvider() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getProvider() != null && !s.getProvider().isBlank()) {
            String p = s.getProvider().toUpperCase();
            // Migration: OPENROUTER was removed. Existing rows pointing to it
            // fall back to HuggingFace.
            if ("OPENROUTER".equals(p)) return DEFAULT_PROVIDER;
            return p;
        }
        return DEFAULT_PROVIDER;
    }

    @Transactional(readOnly = true)
    public String resolveApiKey() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getApiKey() != null && !s.getApiKey().isBlank()) return s.getApiKey();
        return envApiKey;
    }

    @Transactional(readOnly = true)
    public String resolveModel() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getModel() != null && !s.getModel().isBlank()) return s.getModel();
        String provider = resolveProvider();
        return envModel != null && !envModel.isBlank() ? envModel : defaultModel(provider);
    }

    @Transactional
    public String resolveBaseUrl() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        String provider = resolveProvider();

        // Auto-heal: if a stale base URL belonging to a DIFFERENT provider is stored,
        // clear it. This handles the case where the admin switched provider without
        // saving a new URL — the leftover URL would otherwise be used.
        if (s != null && s.getBaseUrl() != null && !s.getBaseUrl().isBlank()
                && !urlMatchesProvider(s.getBaseUrl(), provider)) {
            log.info("Stale baseUrl '{}' doesn't match provider {}, clearing", s.getBaseUrl(), provider);
            s.setBaseUrl(null);
            repo.save(s);
        }

        if (s != null && s.getBaseUrl() != null && !s.getBaseUrl().isBlank()) return s.getBaseUrl();
        return defaultBaseUrl(provider);
    }

    /** Heuristic: does this URL belong to the named provider? */
    private boolean urlMatchesProvider(String url, String provider) {
        String low = url.toLowerCase();
        return switch (provider) {
            case "HUGGINGFACE" -> low.contains("huggingface.co");
            case "CUSTOM"      -> true; // admin knows what they're doing
            default            -> true;
        };
    }

    @Transactional(readOnly = true)
    public Double resolveTemperature() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        return (s != null && s.getTemperature() != null) ? s.getTemperature() : 0.3;
    }

    @Transactional(readOnly = true)
    public Integer resolveMaxTokens() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        return (s != null && s.getMaxTokens() != null) ? s.getMaxTokens() : 2048;
    }

    /**
     * Returns the configured Unsplash Access Key, or null if not set.
     * Used by search_photos to switch from OpenVerse fallback to Unsplash curated search.
     */
    @Transactional(readOnly = true)
    public String resolveUnsplashKey() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getUnsplashAccessKey() != null && !s.getUnsplashAccessKey().isBlank()) {
            return s.getUnsplashAccessKey();
        }
        return null;
    }

    /**
     * Returns the configured Pexels API Key, or null if not set.
     * Preferred over Unsplash when both are present.
     */
    @Transactional(readOnly = true)
    public String resolvePexelsKey() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getPexelsApiKey() != null && !s.getPexelsApiKey().isBlank()) {
            return s.getPexelsApiKey();
        }
        return null;
    }

    /**
     * Return the ordered chain to try when the primary model returns 429.
     * Primary first, then admin-configured fallbacks. De-duplicated.
     */
    @Transactional(readOnly = true)
    public java.util.List<String> resolveModelChain() {
        java.util.LinkedHashSet<String> chain = new java.util.LinkedHashSet<>();
        chain.add(resolveModel());
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        if (s != null && s.getFallbackModels() != null && !s.getFallbackModels().isBlank()) {
            for (String m : s.getFallbackModels().split(",")) {
                String t = m.trim();
                if (!t.isEmpty()) chain.add(t);
            }
        }
        return new java.util.ArrayList<>(chain);
    }

    // ── Admin-facing read / update ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AiSettingsDto get() {
        AiSettings s = repo.findById(SINGLETON_ID).orElse(null);
        String effectiveKey = s != null && s.getApiKey() != null && !s.getApiKey().isBlank()
                ? s.getApiKey() : envApiKey;
        boolean configured = effectiveKey != null && !effectiveKey.isBlank();
        String provider = resolveProvider();
        String unsplashKey = s != null ? s.getUnsplashAccessKey() : null;
        String pexelsKey   = s != null ? s.getPexelsApiKey() : null;
        return AiSettingsDto.builder()
                .provider(provider)
                .maskedApiKey(mask(effectiveKey))
                .configured(configured)
                .model(s != null && s.getModel() != null && !s.getModel().isBlank() ? s.getModel() : resolveModel())
                .baseUrl(s != null && s.getBaseUrl() != null && !s.getBaseUrl().isBlank() ? s.getBaseUrl() : resolveBaseUrl())
                .temperature(s != null ? s.getTemperature() : null)
                .maxTokens(s != null ? s.getMaxTokens() : null)
                .fallbackModels(s != null ? s.getFallbackModels() : null)
                .maskedUnsplashKey(mask(unsplashKey))
                .unsplashConfigured(unsplashKey != null && !unsplashKey.isBlank())
                .maskedPexelsKey(mask(pexelsKey))
                .pexelsConfigured(pexelsKey != null && !pexelsKey.isBlank())
                .updatedAt(s != null ? s.getUpdatedAt() : null)
                .updatedByAdminName(s != null ? s.getUpdatedByAdminName() : null)
                .build();
    }

    @Transactional
    public AiSettingsDto update(UpdateAiSettingsRequest req, Long adminId, String adminName) {
        AiSettings s = repo.findById(SINGLETON_ID).orElseGet(() -> AiSettings.builder().id(SINGLETON_ID).build());
        // Provider: when switching, also reset the API key (different providers use different keys)
        if (req.getProvider() != null && !req.getProvider().isBlank()) {
            String newProvider = req.getProvider().toUpperCase();
            String oldProvider = s.getProvider();
            s.setProvider(newProvider);
            if (oldProvider != null && !oldProvider.equalsIgnoreCase(newProvider)) {
                // Different provider chosen → wipe the old key + URL so we don't mix
                s.setApiKey(null);
                s.setBaseUrl(null);
            }
        }
        // API key: null = keep, "" = clear, "***" or "***************XXXX" pattern = keep (UI sent mask)
        if (req.getApiKey() != null) {
            String k = req.getApiKey();
            if (k.isEmpty()) {
                s.setApiKey(null);
            } else if (!k.startsWith("****")) { // don't accept masked values
                s.setApiKey(k.trim());
            }
        }
        if (req.getModel()       != null) s.setModel(req.getModel().trim().isEmpty() ? null : req.getModel().trim());
        if (req.getBaseUrl()     != null) s.setBaseUrl(req.getBaseUrl().trim().isEmpty() ? null : req.getBaseUrl().trim());
        if (req.getTemperature()    != null) s.setTemperature(req.getTemperature());
        if (req.getMaxTokens()      != null) s.setMaxTokens(req.getMaxTokens());
        if (req.getFallbackModels() != null) s.setFallbackModels(req.getFallbackModels().trim().isEmpty() ? null : req.getFallbackModels().trim());
        // Unsplash key: same null/""/"****..." semantics as the main api key
        if (req.getUnsplashAccessKey() != null) {
            String uk = req.getUnsplashAccessKey();
            if (uk.isEmpty()) s.setUnsplashAccessKey(null);
            else if (!uk.startsWith("****")) s.setUnsplashAccessKey(uk.trim());
        }
        // Pexels key: same semantics
        if (req.getPexelsApiKey() != null) {
            String pk = req.getPexelsApiKey();
            if (pk.isEmpty()) s.setPexelsApiKey(null);
            else if (!pk.startsWith("****")) s.setPexelsApiKey(pk.trim());
        }
        s.setUpdatedByAdminId(adminId);
        s.setUpdatedByAdminName(adminName);
        repo.save(s);
        return get();
    }

    /** Mask everything except the last 4 characters. */
    private String mask(String key) {
        if (key == null || key.isBlank()) return null;
        if (key.length() <= 4) return "****";
        return "****" + "************" + key.substring(key.length() - 4);
    }
}
