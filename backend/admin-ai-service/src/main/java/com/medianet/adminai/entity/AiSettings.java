package com.medianet.adminai.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Singleton settings row (id=1). Stores the LLM provider API key and chosen model.
 *
 * <p>If no row exists, the service falls back to the env var defaults at startup.
 * The first admin who saves through the UI bootstraps the row.
 */
@Entity
@Table(name = "ai_settings")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiSettings {

    @Id
    @Builder.Default
    private Long id = 1L;

    /**
     * Which LLM provider to use. One of: HUGGINGFACE, CUSTOM.
     * Defaults to HUGGINGFACE — generous free Inference Providers tier.
     */
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String provider = "HUGGINGFACE";

    /** API key for the chosen provider — stored as-is; backoffice only ever shows a mask. */
    @Column(columnDefinition = "TEXT")
    private String apiKey;

    /** Full model id, e.g. "meta-llama/Llama-3.3-70B-Instruct" */
    @Column(columnDefinition = "TEXT")
    private String model;

    /** Optional override for the API base URL (defaults to https://router.huggingface.co/v1). */
    @Column(columnDefinition = "TEXT")
    private String baseUrl;

    /** Optional override for sampling temperature (0..2). */
    private Double temperature;

    /** Optional override for max output tokens per turn. */
    private Integer maxTokens;

    /**
     * Comma-separated list of model ids to try if the primary returns 429.
     * Example: "deepseek/deepseek-chat-v3-0324:free,qwen/qwen-2.5-72b-instruct:free"
     */
    @Column(columnDefinition = "TEXT")
    private String fallbackModels;

    /**
     * Optional Unsplash Access Key. When set, search_photos uses Unsplash's curated
     * search API instead of the OpenVerse fallback — dramatically better hero photos.
     * Free tier: 50 requests/hour. Get one at https://unsplash.com/developers
     */
    @Column(columnDefinition = "TEXT")
    private String unsplashAccessKey;

    /**
     * Optional Pexels API Key. Preferred over Unsplash when both are set — Pexels
     * has a larger catalog and no rate limits worth worrying about (200 req/hour,
     * 20K/month free). Get one at https://www.pexels.com/api/
     */
    @Column(columnDefinition = "TEXT")
    private String pexelsApiKey;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /** Last admin who edited the settings (for audit). */
    private Long updatedByAdminId;
    private String updatedByAdminName;
}
