package com.medianet.aiscoring.controller;

import com.medianet.aiscoring.dto.AiScoreResult;
import com.medianet.aiscoring.service.AiScoringOrchestrator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * AI scoring endpoints.
 *
 * POST /api/ai/score/{candidatureId}
 *   → Hybrid AI-assisted evaluation of a candidature.
 *   → Accessible by ADMIN and JURY.
 */
@RestController
@RequestMapping("/api/ai/score")
@RequiredArgsConstructor
public class AiScoringController {

    private final AiScoringOrchestrator orchestrator;

    /**
     * Evaluate a single candidature with hybrid rule-based + Claude AI scoring.
     */
    @PostMapping("/{candidatureId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('JURY')")
    public ResponseEntity<AiScoreResult> score(
            @PathVariable Long candidatureId,
            HttpServletRequest request) {
        String token = (String) request.getAttribute("token");
        if (token == null) {
            // fallback: extract from Authorization header
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) token = header.substring(7);
        }
        AiScoreResult result = orchestrator.score(candidatureId, token);
        return ResponseEntity.ok(result);
    }

    /**
     * Health-check / service info (accessible by any authenticated user).
     */
    @GetMapping("/info")
    public ResponseEntity<Object> info() {
        return ResponseEntity.ok(java.util.Map.of(
                "service", "ai-scoring-service",
                "modes", java.util.List.of("DYNAMIC (programme criteria)", "LEGACY (4 fixed criteria)"),
                "dynamicMode", "Auto-selected when candidature.programmeId is set and programme has active criteria",
                "legacyCriteria", java.util.Map.of(
                        "innovation",   "30%",
                        "feasibility",  "25%",
                        "marketImpact", "25%",
                        "teamQuality",  "20%"
                ),
                "scoring", "Rule-based heuristics + Ollama French commentary"
        ));
    }
}
