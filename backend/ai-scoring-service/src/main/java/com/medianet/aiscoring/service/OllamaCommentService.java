package com.medianet.aiscoring.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.aiscoring.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Calls the local Ollama instance to generate French commentary ONLY.
 * Scores are already computed by the rule engine — this service just adds
 * human-readable explanations.
 *
 * Supports both LEGACY (4 fixed criteria) and DYNAMIC (programme-defined) modes.
 * If Ollama is unreachable, degrades gracefully (aiEnhanced = false).
 */
@Service
@Slf4j
public class OllamaCommentService {

    private final WebClient ollamaWebClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ollama.model}")
    private String model;

    public OllamaCommentService(@Qualifier("ollamaWebClient") WebClient ollamaWebClient) {
        this.ollamaWebClient = ollamaWebClient;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Legacy mode: enriches the 4 fixed criterion commentaries. */
    public AiScoreResult addComments(CandidatureDto candidature, AiScoreResult scored) {
        try {
            String prompt = buildLegacyPrompt(candidature, scored);
            String raw    = callOllama(prompt);
            return applyLegacyComments(scored, raw);
        } catch (Exception e) {
            log.warn("Ollama (legacy) failed for {}: {}. Returning raw scores.", candidature.getId(), e.getMessage());
            return scored;
        }
    }

    /** Dynamic mode: generates a comment per programme criterion. */
    public AiScoreResult addDynamicComments(CandidatureDto candidature, AiScoreResult scored) {
        try {
            String prompt = buildDynamicPrompt(candidature, scored);
            String raw    = callOllama(prompt);
            return applyDynamicComments(scored, raw);
        } catch (Exception e) {
            log.warn("Ollama (dynamic) failed for {}: {}. Returning raw scores.", candidature.getId(), e.getMessage());
            return scored;
        }
    }

    // ── Prompts ───────────────────────────────────────────────────────────────

    private String buildLegacyPrompt(CandidatureDto c, AiScoreResult s) {
        return String.format("""
                Tu es un expert en incubation de startups. Un algorithme a calculé les scores suivants
                pour le projet "%s" (domaine: %s) :

                - Innovation : %d/10
                - Faisabilité technique : %d/10
                - Impact marché : %d/10
                - Qualité équipe : %d/10
                - Score pondéré : %.2f/10  (recommandation : %s)

                Informations du projet :
                Problème : %s
                Solution : %s
                Marché cible : %s
                Stack technique : %s
                Équipe (%d personnes) : %s

                Génère des commentaires courts (2 phrases max) en français pour justifier chaque score.
                Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
                {
                  "innovationCommentary": "...",
                  "feasibilityCommentary": "...",
                  "marketImpactCommentary": "...",
                  "teamQualityCommentary": "...",
                  "globalCommentary": "..."
                }
                """,
                nvl(c.getProjectName()), nvl(c.getDomain()),
                s.getInnovation().getScore(), s.getFeasibility().getScore(),
                s.getMarketImpact().getScore(), s.getTeamQuality().getScore(),
                s.getWeightedScore(), s.getRecommendation(),
                nvl(c.getProblemStatement()), nvl(c.getSolutionDescription()),
                nvl(c.getTargetMarket()), nvl(c.getTechStack()),
                c.getTeamSize() != null ? c.getTeamSize() : 0,
                nvl(c.getTeamBackground()));
    }

    private String buildDynamicPrompt(CandidatureDto c, AiScoreResult s) {
        StringBuilder criteriaBlock = new StringBuilder();
        for (DynamicCriterionScore cs : s.getDynamicScores()) {
            criteriaBlock.append(String.format("  - %s (poids %.0f%%) : %d/10%n",
                    cs.getCriteriaName(), cs.getWeight() * 100, cs.getScore()));
        }

        // Build the JSON schema the model must follow
        StringBuilder jsonSchema = new StringBuilder("{\n");
        for (DynamicCriterionScore cs : s.getDynamicScores()) {
            jsonSchema.append(String.format("  \"criteria_%d\": \"...\",\n", cs.getCriteriaId()));
        }
        jsonSchema.append("  \"globalCommentary\": \"...\"\n}");

        return String.format("""
                Tu es un expert en incubation de startups. Un algorithme a évalué le projet "%s"
                (domaine: %s, score global: %.2f/10, recommandation: %s)
                selon les critères du programme :

                %s
                Informations du projet :
                Problème : %s
                Solution : %s
                Marché cible : %s
                Stack technique : %s
                Équipe (%d personnes) : %s

                Génère des commentaires courts (2 phrases max) en français pour justifier chaque score.
                Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
                %s
                """,
                nvl(c.getProjectName()), nvl(c.getDomain()),
                s.getWeightedScore(), s.getRecommendation(),
                criteriaBlock,
                nvl(c.getProblemStatement()), nvl(c.getSolutionDescription()),
                nvl(c.getTargetMarket()), nvl(c.getTechStack()),
                c.getTeamSize() != null ? c.getTeamSize() : 0,
                nvl(c.getTeamBackground()),
                jsonSchema);
    }

    // ── Ollama call ───────────────────────────────────────────────────────────

    private String callOllama(String prompt) {
        OllamaResponse resp = ollamaWebClient.post()
                .uri("/api/generate")
                .bodyValue(Map.of("model", model, "prompt", prompt, "stream", false))
                .retrieve()
                .bodyToMono(OllamaResponse.class)
                .block();

        if (resp == null || resp.getResponse() == null)
            throw new IllegalStateException("Empty response from Ollama");
        return resp.getResponse().trim();
    }

    // ── Apply comments ────────────────────────────────────────────────────────

    private AiScoreResult applyLegacyComments(AiScoreResult s, String raw) {
        try {
            JsonNode root = objectMapper.readTree(extractJson(raw));
            return AiScoreResult.builder()
                    .candidatureId(s.getCandidatureId())
                    .projectName(s.getProjectName())
                    .dynamicMode(false)
                    .innovation(CriterionScore.builder().score(s.getInnovation().getScore())
                            .commentary(root.path("innovationCommentary").asText(s.getInnovation().getCommentary()))
                            .build())
                    .feasibility(CriterionScore.builder().score(s.getFeasibility().getScore())
                            .commentary(root.path("feasibilityCommentary").asText(s.getFeasibility().getCommentary()))
                            .build())
                    .marketImpact(CriterionScore.builder().score(s.getMarketImpact().getScore())
                            .commentary(root.path("marketImpactCommentary").asText(s.getMarketImpact().getCommentary()))
                            .build())
                    .teamQuality(CriterionScore.builder().score(s.getTeamQuality().getScore())
                            .commentary(root.path("teamQualityCommentary").asText(s.getTeamQuality().getCommentary()))
                            .build())
                    .weightedScore(s.getWeightedScore())
                    .globalCommentary(root.path("globalCommentary").asText(s.getGlobalCommentary()))
                    .recommendation(s.getRecommendation())
                    .aiEnhanced(true)
                    .build();
        } catch (Exception e) {
            log.warn("Could not parse legacy Ollama JSON: {}", e.getMessage());
            return s.toBuilder().globalCommentary(
                    raw.length() > 500 ? raw.substring(0, 500) + "…" : raw).aiEnhanced(true).build();
        }
    }

    private AiScoreResult applyDynamicComments(AiScoreResult s, String raw) {
        try {
            JsonNode root = objectMapper.readTree(extractJson(raw));

            List<DynamicCriterionScore> updated = new ArrayList<>();
            for (DynamicCriterionScore cs : s.getDynamicScores()) {
                String key = "criteria_" + cs.getCriteriaId();
                String commentary = root.has(key)
                        ? root.get(key).asText(cs.getCommentary())
                        : cs.getCommentary();
                updated.add(DynamicCriterionScore.builder()
                        .criteriaId(cs.getCriteriaId())
                        .criteriaName(cs.getCriteriaName())
                        .weight(cs.getWeight())
                        .score(cs.getScore())
                        .commentary(commentary)
                        .build());
            }

            return AiScoreResult.builder()
                    .candidatureId(s.getCandidatureId())
                    .projectName(s.getProjectName())
                    .dynamicMode(true)
                    .dynamicScores(updated)
                    .weightedScore(s.getWeightedScore())
                    .globalCommentary(root.path("globalCommentary").asText(s.getGlobalCommentary()))
                    .recommendation(s.getRecommendation())
                    .aiEnhanced(true)
                    .build();
        } catch (Exception e) {
            log.warn("Could not parse dynamic Ollama JSON: {}", e.getMessage());
            return s.toBuilder().globalCommentary(
                    raw.length() > 500 ? raw.substring(0, 500) + "…" : raw).aiEnhanced(true).build();
        }
    }

    // ── Utils ─────────────────────────────────────────────────────────────────

    private static String extractJson(String text) {
        String s = text.strip();
        if (s.startsWith("```")) {
            s = s.replaceAll("(?s)^```[a-z]*\\s*", "").replaceAll("```\\s*$", "").strip();
        }
        int start = s.indexOf('{');
        int end   = s.lastIndexOf('}');
        if (start >= 0 && end > start) return s.substring(start, end + 1);
        return s;
    }

    private static String nvl(String s) { return s != null ? s : "Non renseigné"; }
}
