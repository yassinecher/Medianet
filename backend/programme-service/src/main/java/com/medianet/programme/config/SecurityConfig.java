package com.medianet.programme.config;

import com.medianet.programme.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public: browse programmes, their criteria, phases AND sessions
                // (sessions = same data as phases, exposed under the new vocabulary).
                // Tasks are NOT public — always require authentication.
                .requestMatchers(HttpMethod.GET,
                    "/api/programmes",
                    "/api/programmes/*/criteria",
                    "/api/programmes/*/phases",
                    "/api/programmes/*/sessions",
                    "/api/programmes/*/sessions/*/days",
                    "/api/programmes/*/partners",
                    "/api/session-presets",
                    "/api/landing-page").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/programmes/*").permitAll()
                // Everything else (including task endpoints) requires authentication
                .anyRequest().authenticated()
            )
            // Anonymous requests get 401 (not Spring's default 403) so the
            // frontend axios interceptor catches it and redirects to /login.
            // 403 is then reserved for authenticated-but-wrong-role cases.
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint((req, resp, e) -> resp.setStatus(401)))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public org.springframework.web.client.RestTemplate restTemplate() {
        return new org.springframework.web.client.RestTemplate();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
