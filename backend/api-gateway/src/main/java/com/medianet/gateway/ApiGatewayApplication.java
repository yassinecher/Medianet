package com.medianet.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Single public entry point for every frontend request. Spring Cloud Gateway
 * (see {@code application.yml} for the route table) forwards {@code /api/**} to
 * the right downstream service by service name, resolved through Eureka — the
 * frontends only ever talk to this gateway, never to a service directly.
 */
@SpringBootApplication
public class ApiGatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
