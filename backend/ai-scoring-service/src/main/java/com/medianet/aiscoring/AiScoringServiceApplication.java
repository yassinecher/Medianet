package com.medianet.aiscoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class AiScoringServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiScoringServiceApplication.class, args);
    }
}
