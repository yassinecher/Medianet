package com.medianet.candidature;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Candidature lifecycle: submission, jury assignment, scoring (per the owning
 * programme's criteria), and the accept/reject decision. Owns its own
 * PostgreSQL database ({@code candidature_db}) and talks to auth-service and
 * programme-service over REST for anything it doesn't own itself.
 */
@SpringBootApplication
public class CandidatureServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(CandidatureServiceApplication.class, args);
    }
}
