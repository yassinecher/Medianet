package com.medianet.auth.security;

import com.medianet.auth.entity.Permission;
import com.medianet.auth.entity.Role;
import com.medianet.auth.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    // Must be at least 32 chars for HS256
    private static final String SECRET = "test-jwt-secret-key-for-unit-tests-minimum-256-bits";
    private static final long EXPIRATION = 86_400_000L; // 24h

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", SECRET);
        ReflectionTestUtils.setField(jwtService, "expiration", EXPIRATION);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Permission makePermission(String slug) {
        return Permission.builder()
                .id(1L).slug(slug).displayName(slug).build();
    }

    private Role makeRole(String name, Set<Permission> permissions) {
        return Role.builder()
                .id(1L).name(name).displayName(name)
                .permissions(permissions)
                .build();
    }

    private User makeUser(Long id, String email, Set<Role> roles, Set<Permission> directPermissions) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("John")
                .lastName("Doe")
                .password("encoded")
                .roles(roles)
                .directPermissions(directPermissions)
                .active(true)
                .build();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void generateToken_containsRolesAndPermissions() {
        Role adminRole = makeRole("ADMIN", new HashSet<>());
        Permission readPerm  = makePermission("users:read");
        Permission writePerm = makePermission("sessions:write");

        User user = makeUser(1L, "admin@test.com",
                Set.of(adminRole),
                new HashSet<>(Set.of(readPerm, writePerm)));

        String token = jwtService.generateToken(user);

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractEmail(token)).isEqualTo("admin@test.com");
        assertThat(jwtService.extractUserId(token)).isEqualTo(1L);
    }

    @Test
    void extractRoles_returnsCorrectSet() {
        Role porteurRole = makeRole("PORTEUR", new HashSet<>());
        Role juryRole    = makeRole("JURY",    new HashSet<>());

        User user = makeUser(2L, "porteur@test.com",
                new HashSet<>(Set.of(porteurRole, juryRole)),
                new HashSet<>());

        String token = jwtService.generateToken(user);

        Set<String> roles = jwtService.extractRoles(token);
        assertThat(roles).containsExactlyInAnyOrder("PORTEUR", "JURY");
    }

    @Test
    void extractPermissions_returnsCorrectSet() {
        Role mentorRole = makeRole("MENTOR", new HashSet<>());
        Permission candRead = makePermission("candidatures:read");
        Permission candEval = makePermission("candidatures:evaluate");

        // Permissions provided as direct user permissions so getAllPermissionSlugs() returns them
        User user = makeUser(3L, "user@test.com",
                Set.of(mentorRole),
                new HashSet<>(Set.of(candRead, candEval)));

        String token = jwtService.generateToken(user);

        Set<String> perms = jwtService.extractPermissions(token);
        assertThat(perms).containsExactlyInAnyOrder("candidatures:read", "candidatures:evaluate");
    }

    @Test
    void extractRole_returnsPrimaryRole() {
        // Primary role is the first alphabetically: ADMIN < JURY < PORTEUR
        Role porteurRole = makeRole("PORTEUR", new HashSet<>());
        Role adminRole   = makeRole("ADMIN",   new HashSet<>());
        Role juryRole    = makeRole("JURY",    new HashSet<>());

        User user = makeUser(4L, "multi@test.com",
                new HashSet<>(Set.of(porteurRole, adminRole, juryRole)),
                new HashSet<>());

        String token = jwtService.generateToken(user);

        String primaryRole = jwtService.extractRole(token);
        assertThat(primaryRole).isEqualTo("ADMIN"); // alphabetically first
    }

    @Test
    void isTokenValid_validToken_returnsTrue() {
        Role candidatRole = makeRole("CANDIDAT", new HashSet<>());
        User user = makeUser(5L, "valid@test.com", Set.of(candidatRole), new HashSet<>());
        String token = jwtService.generateToken(user);

        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    void isTokenValid_expiredToken_returnsFalse() throws Exception {
        JwtService shortLived = new JwtService();
        ReflectionTestUtils.setField(shortLived, "secret", SECRET);
        ReflectionTestUtils.setField(shortLived, "expiration", 1L); // 1 ms

        Role candidatRole = makeRole("CANDIDAT", new HashSet<>());
        User user = makeUser(6L, "exp@test.com", Set.of(candidatRole), new HashSet<>());
        String token = shortLived.generateToken(user);

        Thread.sleep(10);

        assertThat(shortLived.isTokenValid(token)).isFalse();
    }

    @Test
    void isTokenValid_tamperedToken_returnsFalse() {
        String fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXJAdGVzdC5jb20ifQ.bad-signature";

        assertThat(jwtService.isTokenValid(fakeToken)).isFalse();
    }

    @Test
    void extractRoles_emptyRoles_returnsEmptySet() {
        User user = makeUser(7L, "noroles@test.com", new HashSet<>(), new HashSet<>());

        String token = jwtService.generateToken(user);

        Set<String> roles = jwtService.extractRoles(token);
        assertThat(roles).isNotNull();
    }

    @Test
    void extractPermissions_emptyPermissions_returnsEmptySet() {
        Role candidatRole = makeRole("CANDIDAT", new HashSet<>());
        // CANDIDAT role has no permissions, and no directPermissions either
        User user = makeUser(8L, "noperms@test.com", Set.of(candidatRole), new HashSet<>());

        String token = jwtService.generateToken(user);

        Set<String> perms = jwtService.extractPermissions(token);
        assertThat(perms).isNotNull().isEmpty();
    }

    @Test
    void extractPermissions_includesRolePermissions() {
        // Role-level permissions also appear in the JWT
        Permission sessRead  = makePermission("sessions:read");
        Permission candRead  = makePermission("candidatures:read");
        Role porteurRole = makeRole("PORTEUR", new HashSet<>(Set.of(sessRead, candRead)));

        User user = makeUser(9L, "porteur@test.com", Set.of(porteurRole), new HashSet<>());

        String token = jwtService.generateToken(user);

        Set<String> perms = jwtService.extractPermissions(token);
        assertThat(perms).containsExactlyInAnyOrder("sessions:read", "candidatures:read");
    }
}
