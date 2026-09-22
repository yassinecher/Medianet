package com.medianet.programme;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * The largest domain service: programmes, sessions/phases, evaluation criteria,
 * the programme roster (organisation × programme participation with its
 * per-programme mentor), coaching, meetings, availability, workshops, tasks,
 * pitch submissions, partners, the landing-page CMS and file storage (MinIO).
 * Owns its own PostgreSQL database ({@code programme_db}).
 */
@SpringBootApplication
@EnableDiscoveryClient
public class ProgrammeServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProgrammeServiceApplication.class, args);
    }
}
