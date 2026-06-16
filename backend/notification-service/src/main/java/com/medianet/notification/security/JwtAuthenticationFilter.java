package com.medianet.notification.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            if (jwtService.isTokenValid(token)) {
                Claims claims = jwtService.extractAllClaims(token);
                String email  = claims.getSubject();

                List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                // Permission slugs (e.g. "programmes:update") become raw authorities so
                // endpoints can use hasAuthority('module:action') for limited admins.
                Object permsObj = claims.get("permissions");
                if (permsObj instanceof List<?> permList) {
                    for (Object p : permList) {
                        if (p != null) authorities.add(new SimpleGrantedAuthority(String.valueOf(p)));
                    }
                }
                Object rolesObj = claims.get("roles");
                if (rolesObj instanceof List<?> roleList && !roleList.isEmpty()) {
                    for (Object r : roleList) {
                        if (r != null) authorities.add(new SimpleGrantedAuthority("ROLE_" + r));
                    }
                } else {
                    String singleRole = claims.get("role", String.class);
                    if (singleRole != null) authorities.add(new SimpleGrantedAuthority("ROLE_" + singleRole));
                }

                Object userIdObj = claims.get("userId");
                Long userId = null;
                if (userIdObj instanceof Long l)         userId = l;
                else if (userIdObj instanceof Integer i) userId = i.longValue();

                String firstName   = claims.get("firstName",  String.class);
                String primaryRole = claims.get("role",       String.class);

                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    var auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    request.setAttribute("userId",        userId);
                    request.setAttribute("userRole",      primaryRole);
                    request.setAttribute("userFirstName", firstName);
                }
            }
        } catch (Exception ignored) {}

        filterChain.doFilter(request, response);
    }
}
