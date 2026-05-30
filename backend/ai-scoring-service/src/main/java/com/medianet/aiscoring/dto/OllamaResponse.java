package com.medianet.aiscoring.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** Minimal wrapper around Ollama's /api/generate response. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OllamaResponse {
    /** The generated text. */
    private String response;
}
