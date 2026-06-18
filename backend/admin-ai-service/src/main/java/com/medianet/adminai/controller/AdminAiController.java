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
