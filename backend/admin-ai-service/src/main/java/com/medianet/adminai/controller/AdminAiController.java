package com.medianet.adminai.controller;

import com.medianet.adminai.dto.ChatRequest;
import com.medianet.adminai.dto.ChatResponse;
import com.medianet.adminai.entity.ActionStatus;
import com.medianet.adminai.entity.AdminAction;
import com.medianet.adminai.entity.AiConversation;
import com.medianet.adminai.repository.AdminActionRepository;
import com.medianet.adminai.repository.AiConversationRepository;
import com.medianet.adminai.repository.AiMessageRepository;
import com.medianet.adminai.client.OpenRouterClient;
import com.medianet.adminai.dto.AiSettingsDto;
import com.medianet.adminai.dto.UpdateAiSettingsRequest;
import com.medianet.adminai.service.AdminAiService;
import com.medianet.adminai.service.AiSettingsService;
import com.medianet.adminai.service.OpenRouterModelsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin-ai")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminAiController {

    private final AdminAiService           service;
    private final AdminActionRepository    actionRepo;
    private final AiConversationRepository convRepo;
    private final AiMessageRepository      messageRepo;
    private final OpenRouterClient         llm;
    private final AiSettingsService        aiSettings;
    private final OpenRouterModelsService  models;
    private final com.medianet.adminai.service.ToolExecutor toolExecutor;

    // ── Chat ──────────────────────────────────────────────────────────────────

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest req,
            HttpServletRequest http) {
        Long   adminId    = (Long) http.getAttribute("userId");
        String adminName  = (String) http.getAttribute("userFirstName");
        String adminToken = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.chat(req, adminId, adminName, adminToken));
    }

    /**
     * Medi candidature scoring — grounded in the programme, organisation, team
     * members and candidature responses. Open to ADMIN and JURY (front + back);
     * the method-level rule overrides the class-level ADMIN-only.
     */
    @PostMapping("/score/{candidatureId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('JURY')")
    public ResponseEntity<Map<String, Object>> score(
            @PathVariable Long candidatureId, HttpServletRequest http) {
        String token = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.scoreCandidature(candidatureId, token));
    }

    /**
     * Analyse a porteur's pitch from its transcript — scores delivery/content,
     * lists strengths & weaknesses, and gives concrete advice. Any authenticated
     * user: the submission is fetched with the caller's token, so ownership is
     * enforced downstream (owner porteur or admin only).
     */
    @PostMapping("/pitch/analyze")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> analyzePitch(
            @RequestBody Map<String, Object> body, HttpServletRequest http) {
        Long submissionId = body.get("submissionId") == null ? null
                : Long.valueOf(String.valueOf(body.get("submissionId")));
        if (submissionId == null) throw new IllegalArgumentException("submissionId requis");
        String token = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.analyzePitch(submissionId, token));
    }

    /**
     * Live variant — streams the REAL pipeline stages (transcription, élocution,
     * vision, criteria, LLM) as they complete, then a final `done` event with the
     * full analysis. Drives the "AI thinking" panel.
     */
    @PostMapping(value = "/pitch/analyze/stream",
                 produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("isAuthenticated()")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter analyzePitchStream(
            @RequestBody Map<String, Object> body, HttpServletRequest http) {
        Long submissionId = Long.valueOf(String.valueOf(body.get("submissionId")));
        String token = (String) http.getAttribute("token");
        // No servlet timeout — Whisper + LLM can run for minutes.
        var emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(0L);

        // Track the step in flight so the heartbeat can report elapsed/remaining.
        var currentStep  = new java.util.concurrent.atomic.AtomicReference<String>("submission");
        var currentLabel = new java.util.concurrent.atomic.AtomicReference<String>("Démarrage…");
        var currentEta   = new java.util.concurrent.atomic.AtomicReference<Double>(null);
        var stepStart    = new java.util.concurrent.atomic.AtomicLong(System.currentTimeMillis());
        var alive        = new java.util.concurrent.atomic.AtomicBoolean(true);

        /*
         * Heartbeat every 3s. Two jobs:
         *  1. Keeps the SSE connection warm — long silent stages (Whisper, the LLM)
         *     were being dropped by the gateway with PrematureCloseException.
         *  2. Carries a live countdown built from REAL measured stage durations.
         */
        var heartbeat = HEARTBEAT_POOL.scheduleAtFixedRate(() -> {
            if (!alive.get()) return;
            try {
                double elapsed = (System.currentTimeMillis() - stepStart.get()) / 1000.0;
                Double eta = currentEta.get();
                Map<String, Object> p = new java.util.LinkedHashMap<>();
                p.put("step", currentStep.get());
                p.put("label", currentLabel.get());
                p.put("elapsedSec", Math.round(elapsed * 10) / 10.0);
                if (eta != null) {
                    p.put("etaSec", eta);
                    p.put("remainingSec", Math.max(0, Math.round((eta - elapsed) * 10) / 10.0));
                    p.put("percent", (int) Math.min(99, Math.round((elapsed / Math.max(eta, 0.1)) * 100)));
                }
                emitter.send(org.springframework.web.servlet.mvc.method.annotation
                        .SseEmitter.event().name("progress").data(p));
            } catch (Exception e) {
                alive.set(false); // client disconnected
            }
        }, 3, 3, java.util.concurrent.TimeUnit.SECONDS);

        Runnable stop = () -> { alive.set(false); heartbeat.cancel(true); };
        emitter.onCompletion(stop);
        emitter.onError(e -> stop.run());
        emitter.onTimeout(stop);

        CHAT_STREAM_POOL.submit(() -> {
            try {
                Map<String, Object> result = service.analyzePitch(submissionId, token, s -> {
                    // A new step began → reset the countdown baseline.
                    if ("running".equals(s.get("status"))) {
                        currentStep.set(String.valueOf(s.get("step")));
                        currentLabel.set(String.valueOf(s.get("label")));
                        currentEta.set(s.get("etaSec") == null ? null
                                : Double.valueOf(String.valueOf(s.get("etaSec"))));
                        stepStart.set(System.currentTimeMillis());
                    }
                    try { emitter.send(org.springframework.web.servlet.mvc.method.annotation
                            .SseEmitter.event().name("stage").data(s)); }
                    catch (Exception ignored) { alive.set(false); }
                });
                stop.run();  // silence the heartbeat before the final frame
                emitter.send(org.springframework.web.servlet.mvc.method.annotation
                        .SseEmitter.event().name("done").data(result));
                // Give the final (large) frame time to flush through the gateway
                // before closing — an immediate complete() races the write and the
                // browser sees an aborted stream.
                try { Thread.sleep(250); } catch (InterruptedException ignored) {}
                emitter.complete();
            } catch (Exception ex) {
                try {
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation
                            .SseEmitter.event().name("error").data(Map.of("error", String.valueOf(ex.getMessage()))));
                } catch (Exception ignored) {}
                stop.run();
                emitter.complete();
            }
        });
        return emitter;
    }

    /** Keeps SSE streams warm + emits progress countdowns during long stages. */
    private static final java.util.concurrent.ScheduledExecutorService HEARTBEAT_POOL =
            java.util.concurrent.Executors.newScheduledThreadPool(2, r -> {
                Thread t = new Thread(r, "pitch-sse-heartbeat");
                t.setDaemon(true);
                return t;
            });

    /** Dedicated executor for streaming chats — the agent loop can run for minutes. */
    private static final java.util.concurrent.ExecutorService CHAT_STREAM_POOL =
            java.util.concurrent.Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "ai-chat-stream");
                t.setDaemon(true);
                return t;
            });

    /**
     * Live variant of /chat — Server-Sent Events. Emits progress while the agent
     * loop runs: {@code status} (thinking phase), {@code tool_start}/{@code tool_end}
     * (each read tool), {@code action_proposed} (write queued), {@code text}
     * (partial visible text), then a final {@code done} event carrying the same
     * ChatResponse JSON the blocking endpoint returns. {@code error} on failure.
     */
    @PostMapping(value = "/chat/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter chatStream(
            @Valid @RequestBody ChatRequest req,
            HttpServletRequest http) {
        Long   adminId    = (Long) http.getAttribute("userId");
        String adminName  = (String) http.getAttribute("userFirstName");
        String adminToken = (String) http.getAttribute("token");

        // No timeout — the agent loop can legitimately take several minutes
        // (LLM calls are capped at 4-10 min internally).
        var emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(0L);
        var jsonMapper = new com.fasterxml.jackson.databind.ObjectMapper();

        CHAT_STREAM_POOL.submit(() -> {
            try {
                ChatResponse resp = service.chat(req, adminId, adminName, adminToken, (type, data) -> {
                    try {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter
                                .event().name(type).data(jsonMapper.writeValueAsString(data)));
                    } catch (Exception ignored) {
                        // Client disconnected — chat keeps running; everything is persisted.
                    }
                });
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter
                        .event().name("done").data(jsonMapper.writeValueAsString(resp)));
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter
                            .event().name("error").data(jsonMapper.writeValueAsString(
                                    Map.of("message", e.getMessage() == null ? "Erreur inconnue" : e.getMessage()))));
                } catch (Exception ignored) {}
                emitter.complete();
            }
        });
        return emitter;
    }

    // ── Conversations ─────────────────────────────────────────────────────────

    @GetMapping("/conversations")
    public ResponseEntity<List<AiConversation>> myConversations(HttpServletRequest http) {
        Long adminId = (Long) http.getAttribute("userId");
        return ResponseEntity.ok(convRepo.findByAdminIdOrderByUpdatedAtDesc(adminId));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<?> messages(@PathVariable Long id) {
        return ResponseEntity.ok(messageRepo.findByConversationIdOrderByIdAsc(id));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        convRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Actions / audit log ───────────────────────────────────────────────────

    @GetMapping("/actions")
    public ResponseEntity<List<AdminAction>> actions(
            @RequestParam(required = false) String status) {
        if (status == null) return ResponseEntity.ok(actionRepo.findAllByOrderByCreatedAtDesc());
        return ResponseEntity.ok(actionRepo.findByStatusOrderByCreatedAtDesc(ActionStatus.valueOf(status.toUpperCase())));
    }

    @PostMapping("/actions/{id}/confirm")
    public ResponseEntity<AdminAction> confirm(@PathVariable Long id, HttpServletRequest http) {
        Long adminId    = (Long) http.getAttribute("userId");
        String adminToken = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.confirmAction(id, adminId, adminToken));
    }

    @PostMapping("/actions/{id}/cancel")
    public ResponseEntity<AdminAction> cancel(@PathVariable Long id, HttpServletRequest http) {
        Long adminId = (Long) http.getAttribute("userId");
        return ResponseEntity.ok(service.cancelAction(id, adminId));
    }

    @PostMapping("/actions/{id}/revert")
    public ResponseEntity<AdminAction> revert(@PathVariable Long id, HttpServletRequest http) {
        Long adminId      = (Long) http.getAttribute("userId");
        String adminToken = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.revertAction(id, adminId, adminToken));
    }

    // ── Health ────────────────────────────────────────────────────────────────

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> info() {
        return ResponseEntity.ok(Map.of(
            "service", "admin-ai-service",
            "version", "1.0.0",
            "backend", aiSettings.resolveProvider(),
            "model", llm.getModel(),
            "configured", aiSettings.get().isConfigured(),
            "totalActions", actionRepo.count()
        ));
    }

    /**
     * Diagnostics — show what's actually stored and run a live test ping
     * with the stored key. Crucial for debugging "Missing Authentication header".
     */
    @GetMapping("/debug")
    public ResponseEntity<Map<String, Object>> debug() {
        String key = aiSettings.resolveApiKey();
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("provider", aiSettings.resolveProvider());
        out.put("baseUrl",  aiSettings.resolveBaseUrl());
        out.put("model",    aiSettings.resolveModel());
        out.put("apiKeyPresent", key != null && !key.isBlank());
        out.put("apiKeyLength",  key != null ? key.length() : 0);
        out.put("apiKeyPrefix",  key != null && key.length() >= 5 ? key.substring(0, 5) + "…" : null);
        out.put("apiKeyHasWhitespace", key != null && !key.equals(key.trim()));

        // Live ping the LLM with the stored key — this proves whether the issue
        // is storage, the key itself, or something further upstream.
        if (key != null && !key.isBlank()) {
            try {
                Map<String, Object> ping = llm.testConnection(key, aiSettings.resolveModel());
                out.put("livePing", ping);
            } catch (Exception e) {
                out.put("livePing", Map.of("ok", false, "error", e.getMessage()));
            }
        } else {
            out.put("livePing", Map.of("ok", false, "error", "Pas de clé stockée — rien à pinger."));
        }
        return ResponseEntity.ok(out);
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseEntity<AiSettingsDto> getSettings() {
        return ResponseEntity.ok(aiSettings.get());
    }

    @PutMapping("/settings")
    public ResponseEntity<AiSettingsDto> updateSettings(
            @RequestBody UpdateAiSettingsRequest req,
            HttpServletRequest http) {
        Long adminId     = (Long) http.getAttribute("userId");
        String adminName = (String) http.getAttribute("userFirstName");
        return ResponseEntity.ok(aiSettings.update(req, adminId, adminName != null ? adminName : "Admin"));
    }

    /** Send a tiny ping to the configured LLM provider to verify a key+model combo. */
    @PostMapping("/settings/test")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Map<String, String> body) {
        String apiKey = body.get("apiKey");
        String model  = body.get("model");
        // Allow testing with the stored key when the UI sends a mask
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("****")) {
            apiKey = aiSettings.resolveApiKey();
        }
        return ResponseEntity.ok(llm.testConnection(apiKey, model));
    }

    // ── Model catalog ─────────────────────────────────────────────────────────

    /**
     * Search the LLM model catalog with filters.
     * Query params: q, freeOnly, toolsOnly, visionOnly, provider, minContext, refresh
     */
    @GetMapping("/models")
    public ResponseEntity<Map<String, Object>> searchModels(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean freeOnly,
            @RequestParam(defaultValue = "false") boolean toolsOnly,
            @RequestParam(defaultValue = "false") boolean visionOnly,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) Integer minContext,
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (refresh) models.listAll(true);
        OpenRouterModelsService.SearchCriteria c = new OpenRouterModelsService.SearchCriteria();
        c.setQuery(q);
        c.setFreeOnly(freeOnly);
        c.setToolsOnly(toolsOnly);
        c.setVisionOnly(visionOnly);
        c.setProvider(provider);
        c.setMinContext(minContext);
        return ResponseEntity.ok(models.search(c));
    }

    // ── Landing-page AI helpers ───────────────────────────────────────────────

    /**
     * Generate structured content for a single landing-page section in one shot.
     * Bypasses the agent loop — no tool calls, just a focused JSON-mode prompt.
     * The frontend editor uses this for the "✨ Générer" buttons next to each field.
     */
    @PostMapping("/landing-suggest")
    public ResponseEntity<Map<String, Object>> landingSuggest(@RequestBody Map<String, String> body) {
        String section = body.getOrDefault("section", "hero").toLowerCase();
        String brief   = body.getOrDefault("brief", "");
        String locale  = body.getOrDefault("locale", "fr");
        return ResponseEntity.ok(service.suggestLandingContent(section, brief, locale));
    }

    /**
     * Generate or improve a single form field with the LLM. Powers the
     * « générer / améliorer avec l'IA » buttons on the programme wizard.
     * Body: {@code { field, mode: "generate"|"enhance", current?, context?, locale? }}.
     * Returns {@code { value }} (a string) or {@code { values: [...] }} for list fields.
     */
    @PostMapping("/field-suggest")
    public ResponseEntity<Map<String, Object>> fieldSuggest(@RequestBody Map<String, String> body) {
        String field   = body.getOrDefault("field", "").trim();
        String mode     = body.getOrDefault("mode", "generate").trim().toLowerCase();
        String current  = body.getOrDefault("current", "");
        String context  = body.getOrDefault("context", "");
        String locale   = body.getOrDefault("locale", "fr");
        if (field.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "field requis"));
        return ResponseEntity.ok(service.suggestField(field, mode, current, context, locale));
    }

    /**
     * Image search for the editors (landing page, programmes, partners…). Reuses the
     * exact same provider chain (Pexels → Unsplash → OpenVerse → Picsum) as the AI
     * agent's {@code search_photos} tool, so the UI gets the same ready-to-use URLs.
     * Body: {@code { query, context?: hero|feature|partner_logo|team|abstract|generic, count?, width?, height? }}.
     */
    @PostMapping("/search-photos")
    public ResponseEntity<Map<String, Object>> searchPhotos(@RequestBody Map<String, Object> body) {
        if (body == null || body.get("query") == null || String.valueOf(body.get("query")).isBlank()) {
            return ResponseEntity.badRequest().body(Map.<String, Object>of("error", "query requis"));
        }
        return ResponseEntity.ok(toolExecutor.searchPhotos(body));
    }

    /**
     * Execute a multi-step plan submitted from the wizard. Each step is run
     * sequentially; dependencies are auto-back-filled (e.g. a phase step that
     * needs the new programme's id gets it from the previous step's result).
     */
    @PostMapping("/plan/execute")
    public ResponseEntity<Map<String, Object>> executePlan(
            @RequestBody com.medianet.adminai.dto.PlanExecuteRequest req,
            HttpServletRequest http) {
        Long   adminId    = (Long) http.getAttribute("userId");
        String adminName  = (String) http.getAttribute("userFirstName");
        String adminToken = (String) http.getAttribute("token");
        return ResponseEntity.ok(service.executePlan(req.getPlan(), req.getConversationId(),
                                                     adminId, adminName, adminToken));
    }
}
