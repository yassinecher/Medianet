package com.medianet.adminai.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.adminai.service.AiSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Generic OpenAI-compatible LLM client. Targets HuggingFace Inference Providers
 * by default, but works with any OpenAI-format /v1/chat/completions endpoint.
 *
 * <p>Strategy when an LLM call returns 429 (rate limit):
 * <ol>
 *   <li>Parse <code>Retry-After</code> header and/or <code>retry_after_seconds</code> from the body.</li>
 *   <li>If the wait is short (≤ 25s), sleep and retry the same model once.</li>
 *   <li>If still 429, walk the admin-configured fallback model chain and try each.</li>
 *   <li>If everything fails, throw a friendly French error with suggestions.</li>
 * </ol>
 */
@Service
@Slf4j
public class OpenRouterClient {

    // Hand-rolled constructor with explicit @Lazy to avoid the Lombok+@Lazy combination
    // (which can produce a proxy that doesn't always re-read the DB).
    private final AiSettingsService settings;

    public OpenRouterClient(@Lazy AiSettingsService settings) {
        this.settings = settings;
    }

    @Value("${llm.app-name:Medianet Incubateur}")
    private String appName;

    /** Max seconds we'll wait between retries — anything longer = fail-fast & try fallback. */
    private static final int MAX_RETRY_SECONDS = 25;

    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    /** Public entry — auto-handles 429s and fallback models. Uses tool_choice="auto". */
    public Map<String, Object> chat(List<Map<String, Object>> messages,
                                    List<Map<String, Object>> tools,
                                    String systemPrompt) {
        return chat(messages, tools, systemPrompt, "auto");
    }

    /**
     * Public entry with explicit tool_choice control.
     * {@code toolChoice} is one of "auto" (default), "none" (force text reply, no tool calls),
     * or "required" (force at least one tool call).
     */
    public Map<String, Object> chat(List<Map<String, Object>> messages,
                                    List<Map<String, Object>> tools,
                                    String systemPrompt,
                                    String toolChoice) {
        String apiKey  = settings.resolveApiKey();
        String baseUrl = settings.resolveBaseUrl();

        if (apiKey == null || apiKey.isBlank()) {
            String provider = settings.resolveProvider();
            String hint = switch (provider) {
                case "HUGGINGFACE" -> "Créez un token gratuit sur https://huggingface.co/settings/tokens (rôle : Read)";
                default            -> "Saisissez la clé API de votre fournisseur";
            };
            throw new IllegalStateException(
                "Aucune clé " + provider + " configurée. " +
                "Ouvrez Paramètres → Assistant IA dans le backoffice, saisissez votre clé " +
                "et cliquez « Enregistrer » (le bouton Tester ne sauvegarde pas). " + hint + ".");
        }

        // Diagnostic: never log the value, only the shape
        log.info("AI chat call — model chain has {} models, apiKey length={}, starts with '{}'",
                settings.resolveModelChain().size(),
                apiKey.length(),
                apiKey.length() >= 8 ? apiKey.substring(0, 8) + "…" : "??");

        List<String> chain = settings.resolveModelChain();
        StringBuilder triedSummary = new StringBuilder();
        Exception lastFailure = null;

        for (int i = 0; i < chain.size(); i++) {
            String model = chain.get(i);
            boolean isLast = i == chain.size() - 1;
            try {
                Map<String, Object> result = callOnce(apiKey, baseUrl, model, messages, tools, systemPrompt, toolChoice, true);
                if (i > 0) {
                    log.info("Fallback succeeded with model {} (after {} 429s)", model, i);
                }
                return result;
            } catch (RateLimitException rle) {
                String reason = rle.reason; // "rate-limited", "out-of-credits", "quota-exceeded"
                log.warn("Model {} unavailable ({}). {}",
                        model, reason, isLast ? "No more fallbacks." : "Trying next fallback…");
                triedSummary.append("• ").append(model).append(" → ").append(reason).append("\n");
                lastFailure = rle;
                if (isLast) break;
            } catch (java.net.http.HttpTimeoutException te) {
                // Timeout — treat like a rate-limit so we try the next fallback model
                String reason = "timeout (>" + (isLocalEndpoint(baseUrl) ? "10min" : "4min") + ")";
                log.warn("Model {} → {}. {}", model, reason,
                        isLast ? "No more fallbacks." : "Trying next…");
                triedSummary.append("• ").append(model).append(" → ").append(reason).append("\n");
                lastFailure = te;
                if (isLast) break;
            } catch (Exception e) {
                // Hard errors (401, 400, 500…): surface immediately. Use the active provider name.
                String pname = settings.resolveProvider();
                throw new RuntimeException("Appel " + pname + " échoué : " + e.getMessage(), e);
            }
        }

        // Every model exhausted — build a friendly error
        String hint;
        String summary = triedSummary.toString();
        if (summary.contains("timeout")) {
            hint = "Le modèle prend trop de temps à répondre (>4min). " +
                   "Causes possibles : prompt trop long, file d'attente du provider, ou modèle trop lent. " +
                   "Réessaie dans 30s, ou ajoute un modèle plus rapide comme secours dans Paramètres.";
        } else if (summary.contains("out-of-credits") || summary.contains("quota-exceeded")) {
            hint = "Quota épuisé sur tous vos modèles. Ajoutez d'autres modèles de secours dans " +
                   "Paramètres → Assistant IA ou attendez quelques minutes pour la régénération du quota.";
        } else {
            hint = "Tous les modèles sont actuellement saturés (429). " +
                   "Ajoutez d'autres modèles de secours dans Paramètres → Assistant IA ou réessayez dans 30 s.";
        }
        String msg = hint + "\n\nModèles essayés :\n" + summary;
        throw new RuntimeException(msg, lastFailure);
    }

    /**
     * Make one call. If {@code allowRetryOn429} is true and we hit a 429
     * with a short retry-after, we sleep and retry exactly once.
     */
    private Map<String, Object> callOnce(String apiKey, String baseUrl, String model,
                                         List<Map<String, Object>> messages,
                                         List<Map<String, Object>> tools,
                                         String systemPrompt,
                                         String toolChoice,
                                         boolean allowRetryOn429) throws Exception {
        List<Map<String, Object>> finalMessages = new java.util.ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            finalMessages.add(Map.of("role", "system", "content", systemPrompt));
        }
        finalMessages.addAll(messages);

        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", finalMessages);
        body.put("temperature", settings.resolveTemperature());
        body.put("max_tokens",  settings.resolveMaxTokens());
        // tool_choice="none" means: don't pass tools at all (some HF providers
        // 400 if tools+tool_choice="none" appear together). For "auto"/"required"
        // we include both.
        String tc = (toolChoice == null) ? "auto" : toolChoice;
        if (tools != null && !tools.isEmpty() && !"none".equals(tc)) {
            body.put("tools", tools);
            body.put("tool_choice", tc);
        }

        String payload = json.writeValueAsString(body);

        String authValue = "Bearer " + apiKey;
        // Diagnostic log — does NOT print the key, only its shape (so we can verify it's not empty/mangled)
        log.info("LLM HTTP request → {} {} | model={} | Authorization header length={} (prefix='{}')",
                "POST", baseUrl + "/chat/completions", model,
                authValue.length(),
                authValue.length() >= 15 ? authValue.substring(0, 15) + "…" : authValue);

        // Local backends (Ollama, LM Studio, llama.cpp server) on consumer GPUs
        // can take 3-5 minutes for a multi-tool agent turn. Cloud APIs respond
        // quickly for simple turns, but big tools+plan generation on 70B models
        // can hit 2-3 minutes — be generous to avoid timeouts on free-tier queues.
        Duration requestTimeout = isLocalEndpoint(baseUrl)
            ? Duration.ofMinutes(10)
            : Duration.ofMinutes(4);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", authValue)
                .timeout(requestTimeout)
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

        // 429 (rate limit) — sleep + retry, then fall through to next model
        if (resp.statusCode() == 429) {
            int wait = parseRetryAfter(resp);
            if (allowRetryOn429 && wait > 0 && wait <= MAX_RETRY_SECONDS) {
                log.warn("Model {} → 429, sleeping {}s and retrying once", model, wait);
                try { Thread.sleep(wait * 1000L); }
                catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return callOnce(apiKey, baseUrl, model, messages, tools, systemPrompt, toolChoice, false);
            }
            throw new RateLimitException(model, wait, "rate-limited");
        }

        // 402 (insufficient_quota / out of credits) — also try next model.
        if (resp.statusCode() == 402) {
            log.warn("Model {} → 402 Out of credits/quota: {}", model, extractError(resp.body()));
            throw new RateLimitException(model, 0, "out-of-credits");
        }

        // 403 with quota / billing in the message — same treatment
        if (resp.statusCode() == 403 && resp.body() != null
                && (resp.body().contains("quota") || resp.body().contains("credit") || resp.body().contains("billing"))) {
            log.warn("Model {} → 403 quota: {}", model, extractError(resp.body()));
            throw new RateLimitException(model, 0, "quota-exceeded");
        }

        if (resp.statusCode() >= 400) {
            String pname = settings.resolveProvider();
            String err = extractError(resp.body());
            log.error("{} error {} on model {}: {}", pname, resp.statusCode(), model, resp.body());

            // Authentication failure — give a much more actionable French message
            if (resp.statusCode() == 401 || resp.statusCode() == 403) {
                String hint = switch (pname) {
                    case "HUGGINGFACE" -> "Vérifiez que votre token HuggingFace est valide et qu'il a le rôle « Read » " +
                                          "(ou « Make calls to Inference Providers »). " +
                                          "Créez un token sur https://huggingface.co/settings/tokens.";
                    default            -> "Vérifiez la clé API dans Paramètres → Assistant IA.";
                };
                throw new RuntimeException(pname + " " + resp.statusCode() + " — « " + err + " ». " + hint, null);
            }

            throw new RuntimeException(pname + " " + resp.statusCode() + " on " + model + ": " + err);
        }
        return json.readValue(resp.body(), new TypeReference<>() {});
    }

    /** Ping a key+model combo. */
    public Map<String, Object> testConnection(String apiKey, String model) {
        if (apiKey == null || apiKey.isBlank())
            return Map.of("ok", false, "error", "Clé API requise");
        if (model == null || model.isBlank()) model = settings.resolveModel();
        String baseUrl = settings.resolveBaseUrl();
        try {
            Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", "ping")),
                "max_tokens", 5
            );
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 429) {
                int wait = parseRetryAfter(resp);
                return Map.of(
                    "ok", false,
                    "status", 429,
                    "rateLimited", true,
                    "retryAfterSeconds", wait,
                    "error", "Modèle saturé (rate-limited). Réessayez dans " + wait + "s ou choisissez un autre modèle gratuit."
                );
            }
            if (resp.statusCode() == 402) {
                return Map.of(
                    "ok", false,
                    "status", 402,
                    "outOfCredits", true,
                    "error", "Quota épuisé pour ce modèle. Essayez un autre modèle ou ajoutez-en un comme secours."
                );
            }
            if (resp.statusCode() >= 400) {
                return Map.of("ok", false, "status", resp.statusCode(), "error", extractError(resp.body()));
            }
            return Map.of("ok", true, "status", resp.statusCode(), "model", model);
        } catch (Exception e) {
            return Map.of("ok", false, "error", e.getMessage());
        }
    }

    public String getModel() { return settings.resolveModel(); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Detect endpoints that point at a local/self-hosted LLM runtime so we can
     * give them a much longer timeout (consumer GPUs take minutes, not seconds).
     */
    private static boolean isLocalEndpoint(String url) {
        if (url == null) return false;
        String low = url.toLowerCase();
        return low.contains("localhost")
            || low.contains("127.0.0.1")
            || low.contains("0.0.0.0")
            || low.contains("ollama")
            || low.contains("lm-studio")
            || low.contains("llamacpp")
            || low.contains("llama-cpp");
    }

    private int parseRetryAfter(HttpResponse<String> resp) {
        try {
            String h = resp.headers().firstValue("Retry-After").orElse(null);
            if (h != null) return Integer.parseInt(h.trim());
        } catch (Exception ignored) {}
        try {
            Map<String, Object> err = json.readValue(resp.body(), new TypeReference<>() {});
            Object errorObj = err.get("error");
            if (errorObj instanceof Map<?, ?> e) {
                Object meta = ((Map<?, ?>) e).get("metadata");
                if (meta instanceof Map<?, ?> m) {
                    Object retry = ((Map<?, ?>) m).get("retry_after_seconds");
                    if (retry != null) return (int) Math.ceil(Double.parseDouble(retry.toString()));
                }
            }
        } catch (Exception ignored) {}
        return 5;
    }

    private String extractError(String body) {
        if (body == null) return "(empty response)";
        try {
            Map<String, Object> parsed = json.readValue(body, new TypeReference<>() {});
            Object errorObj = parsed.get("error");
            if (errorObj instanceof Map<?, ?> e) {
                Object meta = ((Map<?, ?>) e).get("metadata");
                if (meta instanceof Map<?, ?> m) {
                    Object r = ((Map<?, ?>) m).get("raw");
                    if (r != null) return r.toString();
                }
                Object msg = ((Map<?, ?>) e).get("message");
                if (msg != null) return msg.toString();
            }
        } catch (Exception ignored) {}
        return body.length() > 300 ? body.substring(0, 300) + "…" : body;
    }

    /**
     * Internal marker so the chain logic knows to try the next model.
     * {@code reason} is one of: "rate-limited", "out-of-credits", "quota-exceeded".
     */
    private static class RateLimitException extends Exception {
        @SuppressWarnings("unused") final String model;
        @SuppressWarnings("unused") final int retryAfterSec;
        final String reason;
        RateLimitException(String model, int retryAfterSec, String reason) {
            super(reason + " on " + model + (retryAfterSec > 0 ? " (retry-after " + retryAfterSec + "s)" : ""));
            this.model = model;
            this.retryAfterSec = retryAfterSec;
            this.reason = reason;
        }
    }
}
