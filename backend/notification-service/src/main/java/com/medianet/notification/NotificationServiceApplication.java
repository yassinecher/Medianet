package com.medianet.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Outbound communication: role invitations with RSVP tracking, freeform email,
 * and session/participant notifications, sent through Brevo SMTP. Owns its own
 * PostgreSQL database ({@code notification_db}).
 */
@SpringBootApplication
@EnableDiscoveryClient
public class NotificationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
