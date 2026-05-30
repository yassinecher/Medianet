package com.medianet.adminai.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AiSettingsDto {
    /** Provider id: "HUGGINGFACE" | "CUSTOM" */
    private String provider;
    /** Masked api key (only last 4 chars visible) — never the raw value. */
    private String maskedApiKey;
    /** Whether an api key is configured (true even if it was set via env var). */
    private boolean configured;
    private String model;
    private String baseUrl;
    private Double temperature;
    private Integer maxTokens;
    /** CSV of fallback model ids (used when the primary returns 429). */
    private String fallbackModels;
    /** Masked Unsplash access key (never the raw value). */
    private String maskedUnsplashKey;
    /** True if an Unsplash key is configured (improves photo quality). */
    private boolean unsplashConfigured;
    /** Masked Pexels API key. */
    private String maskedPexelsKey;
    /** True if a Pexels key is configured (preferred over Unsplash). */
    private boolean pexelsConfigured;
    private LocalDateTime updatedAt;
    private String updatedByAdminName;
}
