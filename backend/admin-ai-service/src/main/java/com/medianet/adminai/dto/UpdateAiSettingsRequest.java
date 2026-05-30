package com.medianet.adminai.dto;

import lombok.Data;

@Data
public class UpdateAiSettingsRequest {
    /** HUGGINGFACE | CUSTOM */
    private String provider;
    /** Send the full raw API key. Send null to keep the existing key untouched. Send "" to clear it. */
    private String apiKey;
    private String model;
    private String baseUrl;
    private Double temperature;
    private Integer maxTokens;
    private String fallbackModels;
    /** Optional Unsplash Access Key. Null = keep, "" = clear, "****..." = ignored (mask). */
    private String unsplashAccessKey;
    /** Optional Pexels API Key — same semantics. */
    private String pexelsApiKey;
}
