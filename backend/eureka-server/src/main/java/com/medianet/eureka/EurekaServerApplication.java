package com.medianet.eureka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Service registry (Netflix Eureka). Every other Spring Boot service registers
 * itself here on startup; the API gateway and inter-service REST calls resolve
 * a logical name (e.g. {@code lb://auth-service}) to a live instance through it.
 * Dashboard: http://localhost:8761.
 */
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
