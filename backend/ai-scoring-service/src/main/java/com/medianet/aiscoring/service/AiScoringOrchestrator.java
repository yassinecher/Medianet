package com.medianet.aiscoring.service;

import com.medianet.aiscoring.dto.AiScoreResult;
import com.medianet.aiscoring.dto.CandidatureDto;
import com.medianet.aiscoring.dto.ProgrammeCriteriaDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

/**
 * Hybrid scoring pipeline:
 *
 * DYNAMIC mode (when candidature.programmeId != null):
 *  1. Fetch candidature from candidature-service
 *  2. Fetch programme criteria from programme-service
 *  3. Rule-based scoring against each criterion with its weight
 *  4. Ollama adds French commentary per criterion
 *
 * LEGACY mode (no programmeId or no criteria found):
 *  1. Fetch candidature from candidature-service
 *  2. Rule-based scoring against 4 fixed criteria
 *  3. Ollama adds French commentary
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiScoringOrchestrator {

    private final WebClient             candidatureWebClient;
    @Qualifier("programmeWebClient")
    private final WebClient             programmeWebClient;
    private final RuleBasedScoringService ruleBasedScoringService;
    private final OllamaCommentService    ollamaCommentService;

    public AiScoreResult score(Long candidatureId, String bearerToken) {
        // Step 1 — fetch candidature
        CandidatureDto candidature = fetchCandidature(candidatureId, bearerToken);
        log.debug("Scoring candidature {} (programmeId={})", candidatureId, candidature.getProgrammeId());

        // Step 2 — choose mode
        if (candidature.getProgrammeId() != null) {
            List<ProgrammeCriteriaDto> criteria = fetchCriteria(candidature.getProgrammeId());
            if (criteria != null && !criteria.isEmpty()) {
                return scoreDynamic(candidature, criteria);
            }
            log.info("Programme {} has no active criteria — falling back to legacy mode", candidature.getProgrammeId());
        }

        return scoreLegacy(candidature);
    }

    // ── Private pipelines ─────────────────────────────────────────────────────

    private AiScoreResult scoreDynamic(CandidatureDto c, List<ProgrammeCriteriaDto> criteria) {
        log.debug("Dynamic scoring with {} criteria", criteria.size());
        AiScoreResult scored = ruleBasedScoringService.scoreDynamic(c, criteria);
        AiScoreResult withComments = ollamaCommentService.addDynamicComments(c, scored);
        log.debug("Dynamic score: {}, aiEnhanced={}", withComments.getWeightedScore(), withComments.isAiEnhanced());
        return withComments;
    }

    private AiScoreResult scoreLegacy(CandidatureDto c) {
        log.debug("Legacy scoring (4 fixed criteria)");
        AiScoreResult scored = ruleBasedScoringService.score(c);
        AiScoreResult withComments = ollamaCommentService.addComments(c, scored);
        log.debug("Legacy score: {}, aiEnhanced={}", withComments.getWeightedScore(), withComments.isAiEnhanced());
        return withComments;
    }

    // ── HTTP calls ────────────────────────────────────────────────────────────

    private CandidatureDto fetchCandidature(Long id, String token) {
        return candidatureWebClient.get()
                .uri("/api/candidatures/{id}", id)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .bodyToMono(CandidatureDto.class)
                .blockOptional()
                .orElseThrow(() -> new IllegalArgumentException("Candidature not found: " + id));
    }

    private List<ProgrammeCriteriaDto> fetchCriteria(Long programmeId) {
        try {
            return programmeWebClient.get()
                    .uri("/api/programmes/{id}/criteria", programmeId)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<ProgrammeCriteriaDto>>() {})
                    .block();
        } catch (Exception e) {
            log.warn("Could not fetch criteria for programme {}: {}", programmeId, e.getMessage());
            return List.of();
        }
    }
}
