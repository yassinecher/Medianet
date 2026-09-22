package com.medianet.adminai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * The AI layer: candidature scoring, the admin chat assistant (tool-calling
 * agent over the other services), and content generation (landing-page copy,
 * photo search). Talks to a configurable LLM backend (HuggingFace Inference
 * Providers by default, or a self-hosted Ollama model) and to pitch-media-service
 * for pitch-video transcription/analysis. Owns its own PostgreSQL database
 * ({@code admin_ai_db}).
 */
@SpringBootApplication
@EnableDiscoveryClient
public class AdminAiServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdminAiServiceApplication.class, args);
    }
}
