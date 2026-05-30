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
