package com.medianet.aiscoring.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${candidature.service.url}")
    private String candidatureServiceUrl;

    @Value("${programme.service.url}")
    private String programmeServiceUrl;

    @Value("${ollama.url}")
    private String ollamaUrl;

    @Bean
    public WebClient candidatureWebClient() {
        return WebClient.builder()
                .baseUrl(candidatureServiceUrl)
                .build();
    }

    @Bean("programmeWebClient")
    public WebClient programmeWebClient() {
        return WebClient.builder()
                .baseUrl(programmeServiceUrl)
                .build();
    }

    @Bean
    public WebClient ollamaWebClient() {
        return WebClient.builder()
                .baseUrl(ollamaUrl)
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }
}
