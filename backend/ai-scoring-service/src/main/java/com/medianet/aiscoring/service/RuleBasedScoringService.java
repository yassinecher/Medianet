package com.medianet.aiscoring.service;

import com.medianet.aiscoring.dto.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Heuristic (rule-based) scorer — first pass in the hybrid pipeline.
 *
 * Supports two modes:
 *  - LEGACY:  4 hard-coded criteria (innovation/feasibility/marketImpact/teamQuality)
 *  - DYNAMIC: programme-defined criteria, scored by text-overlap with candidature
 */
@Service
public class RuleBasedScoringService {

    // ── Keyword banks for legacy mode ─────────────────────────────────────────

    private static final List<String> INNOVATIVE_KEYWORDS = List.of(
            "ai", "intelligence artificielle", "blockchain", "iot", "ar", "vr",
            "machine learning", "ml", "deep learning", "automation", "robotics",
            "biotech", "fintech", "edtech", "healthtech", "cleantech", "saas",
            "platform", "marketplace", "api", "cloud", "data"
    );
    private static final List<String> TECH_KEYWORDS = List.of(
            "java", "python", "react", "angular", "node", "spring", "kubernetes",
            "docker", "aws", "azure", "gcp", "microservices", "rest", "graphql",
            "postgresql", "mongodb", "redis", "kafka", "rabbitmq", "tensorflow",
            "pytorch", "flutter", "swift", "kotlin", ".net", "typescript"
    );
    private static final List<String> MARKET_KEYWORDS = List.of(
            "b2b", "b2c", "saas", "subscription", "freemium", "marketplace",
            "platform", "ecosystem", "scalable", "global", "international",
            "growth", "revenue", "monetize", "target", "segment", "customer"
    );

    // ── LEGACY scoring ────────────────────────────────────────────────────────

    public AiScoreResult score(CandidatureDto c) {
        int innov  = scoreInnovation(c);
        int feasib = scoreFeasibility(c);
        int market = scoreMarketImpact(c);
        int team   = scoreTeamQuality(c);
        double weighted = legacyWeighted(innov, feasib, market, team);

        return AiScoreResult.builder()
                .candidatureId(c.getId())
                .projectName(c.getProjectName())
                .dynamicMode(false)
                .innovation(CriterionScore.builder().score(innov)
                        .commentary("Score préliminaire basé sur les mots-clés du domaine et de la description.")
                        .build())
                .feasibility(CriterionScore.builder().score(feasib)
                        .commentary("Score préliminaire basé sur la stack technique et l'avancement du projet.")
                        .build())
                .marketImpact(CriterionScore.builder().score(market)
                        .commentary("Score préliminaire basé sur la description du marché et du modèle économique.")
                        .build())
                .teamQuality(CriterionScore.builder().score(team)
                        .commentary("Score préliminaire basé sur la taille et le profil de l'équipe.")
                        .build())
                .weightedScore(weighted)
                .globalCommentary("Évaluation préliminaire par règles — en attente d'enrichissement IA.")
                .recommendation(recommend(weighted))
                .aiEnhanced(false)
                .build();
    }

    // ── DYNAMIC scoring ───────────────────────────────────────────────────────

    /**
     * Scores a candidature against programme-defined criteria.
     * Uses token-overlap between criterion name/description and candidature text.
     */
    public AiScoreResult scoreDynamic(CandidatureDto c, List<ProgrammeCriteriaDto> criteria) {
        String candidatureText = buildCandidatureText(c);

        List<DynamicCriterionScore> scores = new ArrayList<>();
        double weightedSum = 0;
        double totalWeight = 0;

        for (ProgrammeCriteriaDto criterion : criteria) {
            if (Boolean.FALSE.equals(criterion.getActive())) continue;

            int score = scoreAgainstCriterion(candidatureText, criterion);
            double w  = (criterion.getWeight() != null && criterion.getWeight() > 0)
                        ? criterion.getWeight() : 1.0;

            scores.add(DynamicCriterionScore.builder()
                    .criteriaId(criterion.getId())
                    .criteriaName(criterion.getName())
                    .weight(w)
                    .score(score)
                    .commentary("Score préliminaire — en attente de commentaire IA.")
                    .build());

            weightedSum += (double) score * w;
            totalWeight += w;
        }

        // Fallback to legacy if no active criteria
        if (scores.isEmpty()) return score(c);

        double weighted = totalWeight > 0
                ? Math.round(weightedSum / totalWeight * 100.0) / 100.0
                : 0;

        return AiScoreResult.builder()
                .candidatureId(c.getId())
                .projectName(c.getProjectName())
                .dynamicMode(true)
                .dynamicScores(scores)
                .weightedScore(weighted)
                .globalCommentary("Évaluation préliminaire par règles — en attente d'enrichissement IA.")
                .recommendation(recommend(weighted))
                .aiEnhanced(false)
                .build();
    }

    // ── General criterion scorer ──────────────────────────────────────────────

    /**
     * Scores how well a candidature addresses a given criterion.
     *
     * Strategy:
     *  1. Tokenise criterion name + description into meaningful words (>3 chars)
     *  2. Count how many of those tokens appear in the candidature text
     *  3. Baseline 4 + up to 3 token-hit bonus + description length bonus
     */
    private int scoreAgainstCriterion(String candidatureText, ProgrammeCriteriaDto criterion) {
        int score = 4; // baseline

        // Build search tokens from criterion name + description
        String criterionText = lower(criterion.getName(), criterion.getDescription());
        String[] tokens = criterionText.split("[\\s,;:./\\-]+");
        int hits = 0;
        for (String token : tokens) {
            if (token.length() > 3 && candidatureText.contains(token)) hits++;
        }
        score += Math.min(hits, 3);

        // Bonus for rich candidature descriptions
        if (candidatureText.length() > 500)  score += 1;
        if (candidatureText.length() > 1200) score += 1;

        return clamp(score);
    }

    // ── Legacy individual criteria ────────────────────────────────────────────

    private int scoreInnovation(CandidatureDto c) {
        int score = 4;
        String combined = lower(c.getProjectDescription(), c.getProblemStatement(),
                c.getSolutionDescription(), c.getDomain(), c.getTechStack());
        score += (int) Math.min(INNOVATIVE_KEYWORDS.stream().filter(combined::contains).count(), 3);
        if (combined.length() > 500)  score += 1;
        if (combined.length() > 1000) score += 1;
        return clamp(score);
    }

    private int scoreFeasibility(CandidatureDto c) {
        int score = 4;
        String combined = lower(c.getTechStack(), c.getCurrentStage(), c.getTeamBackground());
        score += (int) Math.min(TECH_KEYWORDS.stream().filter(combined::contains).count(), 3);
        if (lower(c.getCurrentStage()).contains("mvp"))        score += 1;
        if (lower(c.getCurrentStage()).contains("production")) score += 2;
        return clamp(score);
    }

    private int scoreMarketImpact(CandidatureDto c) {
        int score = 4;
        String combined = lower(c.getTargetMarket(), c.getBusinessModel(), c.getProjectDescription());
        score += (int) Math.min(MARKET_KEYWORDS.stream().filter(combined::contains).count(), 3);
        if (combined.length() > 300) score += 1;
        return clamp(score);
    }

    private int scoreTeamQuality(CandidatureDto c) {
        int score = 4;
        if (c.getTeamSize() != null) {
            if (c.getTeamSize() >= 2) score += 1;
            if (c.getTeamSize() >= 4) score += 1;
        }
        String bg = lower(c.getTeamBackground());
        if (bg.length() > 200) score += 1;
        if (bg.contains("experience") || bg.contains("expérience")) score += 1;
        if (bg.contains("founder")    || bg.contains("cto") || bg.contains("ceo")) score += 1;
        return clamp(score);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildCandidatureText(CandidatureDto c) {
        return lower(c.getProjectDescription(), c.getProblemStatement(),
                c.getSolutionDescription(), c.getDomain(), c.getTechStack(),
                c.getBusinessModel(), c.getTeamBackground(), c.getTargetMarket());
    }

    public static double legacyWeighted(int innov, int feasib, int market, int team) {
        return Math.round((innov * 0.30 + feasib * 0.25 + market * 0.25 + team * 0.20) * 100.0) / 100.0;
    }

    public static String recommend(double score) {
        if (score >= 7.0) return "ACCEPT";
        if (score >= 5.0) return "REVIEW";
        return "REJECT";
    }

    private static int clamp(int v) { return Math.max(0, Math.min(10, v)); }

    private static String lower(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) if (p != null) sb.append(p.toLowerCase(Locale.ROOT)).append(' ');
        return sb.toString();
    }
}
