package com.medianet.gateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side revocation of JWTs whose roles/permissions are out of date.
 *
 * <p>Downstream services trust the JWT claims until the token expires. The
 * auth-service therefore stamps every token with a {@code tv} (token version)
 * claim and bumps the user's version whenever their roles, permissions or
 * active flag change. This filter compares the two and answers
 * {@code 401 {code: "TOKEN_STALE"}} for an outdated token — the frontends then
 * call {@code /api/auth/refresh} (always allowed) and retry with a fresh token.
 *
 * <p>The current version is fetched from auth-service with the caller's OWN
 * Bearer token (no public/internal endpoint) and cached briefly per user. The
 * token's signature is not checked here — downstream services still do that; a
 * forged token can only make this filter reject, never accept.
 */
@Component
public class TokenVersionFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(TokenVersionFilter.class);
    private static final long CACHE_TTL_MS = 10_000;

    /** Paths a stale token may still call: re-issuing it, and the live events stream. */
    private static final List<String> EXEMPT = List.of(
            "/api/auth/refresh", "/api/auth/token-version", "/api/auth/events/",
            "/api/auth/login", "/api/auth/register", "/api/auth/google");

    private record Cached(int version, long at) {}

    private final Map<Long, Cached> cache = new ConcurrentHashMap<>();
    private final WebClient authClient;
    private final ObjectMapper mapper;

    public TokenVersionFilter(@LoadBalanced WebClient.Builder builder, ObjectMapper mapper) {
        this.authClient = builder.baseUrl("http://auth-service").build();
        this.mapper = mapper;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (!path.startsWith("/api/") || EXEMPT.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }
        String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) return chain.filter(exchange);

        JsonNode claims = decodePayload(auth.substring(7));
        // Service-to-service tokens carry no userId — nothing to revoke.
        if (claims == null || !claims.hasNonNull("userId")) return chain.filter(exchange);
        long userId = claims.get("userId").asLong();
        int tokenVersion = claims.path("tv").asInt(0);

        return currentVersion(userId, auth, tokenVersion)
                // Fail open: if auth-service is unreachable, don't take the platform down.
                .onErrorResume(e -> {
                    log.debug("token-version lookup failed for user {}: {}", userId, e.getMessage());
                    return Mono.just(-1);
                })
                .flatMap(current -> tokenVersion < current
                        ? reject(exchange.getResponse())
                        : chain.filter(exchange));
    }

    private Mono<Integer> currentVersion(long userId, String authHeader, int tokenVersion) {
        Cached c = cache.get(userId);
        long now = System.currentTimeMillis();
        // A token newer than the cached value means the cache is behind — refetch.
        if (c != null && now - c.at() < CACHE_TTL_MS && tokenVersion <= c.version()) {
            return Mono.just(c.version());
        }
        return authClient.get().uri("/api/auth/token-version")
                .header(HttpHeaders.AUTHORIZATION, authHeader)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(3))
                .map(body -> body.path("tv").asInt(0))
                .doOnNext(v -> cache.put(userId, new Cached(v, System.currentTimeMillis())));
    }

    private JsonNode decodePayload(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return null;
            byte[] json = Base64.getUrlDecoder().decode(parts[1]);
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private Mono<Void> reject(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"code\":\"TOKEN_STALE\",\"error\":\"Vos rôles ou permissions ont changé — session à actualiser\","
                + "\"message\":\"Vos rôles ou permissions ont changé — session à actualiser\"}";
        DataBuffer buf = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buf));
    }

    @Configuration
    static class ClientConfig {
        @Bean
        @LoadBalanced
        WebClient.Builder loadBalancedWebClientBuilder() {
            return WebClient.builder();
        }
    }
}
