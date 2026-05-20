package com.medianet.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.auth.dto.*;
import com.medianet.auth.entity.Permission;
import com.medianet.auth.entity.Role;
import com.medianet.auth.entity.User;
import com.medianet.auth.repository.PermissionRepository;
import com.medianet.auth.repository.RoleRepository;
import com.medianet.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration," +
        "org.springframework.cloud.netflix.eureka.EurekaClientAutoConfiguration," +
        "org.springframework.cloud.netflix.eureka.EurekaDiscoveryClientConfiguration," +
        "org.springframework.cloud.client.CommonsClientAutoConfiguration"
    }
)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(locations = "classpath:application-test.properties")
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private String adminToken;
    private Long adminUserId;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Fetch a Role from the DB (seeded on startup). Throws if not found. */
    private Role role(String name) {
        return roleRepository.findByName(name)
                .orElseThrow(() -> new IllegalStateException("Role not seeded: " + name));
    }

    /** Fetch a Permission from the DB (seeded on startup). Throws if not found. */
    private Permission perm(String slug) {
        return permissionRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Permission not seeded: " + slug));
    }

    @BeforeEach
    void setUp() throws Exception {
        userRepository.deleteAll();

        // Create admin user using the seeded ADMIN Role entity
        User admin = User.builder()
                .email("admin@test.com")
                .firstName("Admin")
                .lastName("Test")
                .password(passwordEncoder.encode("Admin1234!"))
                .roles(new HashSet<>(Set.of(role("ADMIN"))))
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        admin = userRepository.save(admin);
        adminUserId = admin.getId();

        // Log in to obtain JWT
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("admin@test.com");
        loginReq.setPassword("Admin1234!");

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();

        AuthResponse authResponse = objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class);
        adminToken = authResponse.getToken();
    }

    // ── POST /api/auth/register ────────────────────────────────────────────────

    @Test
    void register_returnsOkWithRolesArray() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("porteur@test.com");
        req.setFirstName("Alice");
        req.setLastName("Martin");
        req.setPassword("Password1!");
        req.setRole("PORTEUR");

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        AuthResponse resp = objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class);

        assertThat(resp.getToken()).isNotBlank();
        assertThat(resp.getRoles()).contains("PORTEUR");
        assertThat(resp.getRole()).isEqualTo("PORTEUR");
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    @Test
    void login_returnsTokenWithRolesAndPermissions() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("admin@test.com");
        req.setPassword("Admin1234!");

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        AuthResponse resp = objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class);

        assertThat(resp.getToken()).isNotBlank();
        assertThat(resp.getRoles()).contains("ADMIN");
        assertThat(resp.getPermissions()).isNotNull();
        assertThat(resp.getEmail()).isEqualTo("admin@test.com");
    }

    // ── GET /api/auth/users without token → 401/403 ──────────────────────────

    @Test
    void getUsers_withoutToken_returns401or403() throws Exception {
        mockMvc.perform(get("/api/auth/users"))
                .andExpect(result ->
                        assertThat(result.getResponse().getStatus()).isIn(401, 403));
    }

    // ── PUT /api/auth/users/{id}/roles as admin ───────────────────────────────

    @Test
    void syncRoles_asAdmin_returnsUpdatedRoles() throws Exception {
        User user = User.builder()
                .email("candidate@test.com")
                .firstName("Bob")
                .lastName("Smith")
                .password(passwordEncoder.encode("pass1234"))
                .roles(new HashSet<>(Set.of(role("CANDIDAT"))))
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        user = userRepository.save(user);
        Long userId = user.getId();

        AssignRolesRequest req = new AssignRolesRequest();
        req.setRoles(Set.of("PORTEUR", "JURY"));

        MvcResult result = mockMvc.perform(put("/api/auth/users/" + userId + "/roles")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UserDto dto = objectMapper.readValue(result.getResponse().getContentAsString(), UserDto.class);
        assertThat(dto.getRoles()).containsExactlyInAnyOrder("PORTEUR", "JURY");
        assertThat(dto.getRoles()).doesNotContain("CANDIDAT");
    }

    // ── PUT /api/auth/users/{id}/permissions as admin ─────────────────────────

    @Test
    void syncPermissions_asAdmin_returnsUpdated() throws Exception {
        User user = User.builder()
                .email("user2@test.com")
                .firstName("Carol")
                .lastName("Jones")
                .password(passwordEncoder.encode("pass1234"))
                .roles(new HashSet<>(Set.of(role("MENTOR"))))
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        user = userRepository.save(user);
        Long userId = user.getId();

        GrantPermissionRequest req = new GrantPermissionRequest();
        req.setPermissions(Set.of("candidatures:read", "sessions:read"));

        MvcResult result = mockMvc.perform(put("/api/auth/users/" + userId + "/permissions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UserDto dto = objectMapper.readValue(result.getResponse().getContentAsString(), UserDto.class);
        // directPermissions holds exactly what was synced
        assertThat(dto.getDirectPermissions()).containsExactlyInAnyOrder("candidatures:read", "sessions:read");
    }

    // ── POST /api/auth/users/{id}/permissions/grant as admin ──────────────────

    @Test
    void grantPermissions_asAdmin_returns200() throws Exception {
        User user = User.builder()
                .email("user3@test.com")
                .firstName("Dave")
                .lastName("Brown")
                .password(passwordEncoder.encode("pass1234"))
                .roles(new HashSet<>(Set.of(role("JURY"))))
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        user = userRepository.save(user);
        Long userId = user.getId();

        GrantPermissionRequest req = new GrantPermissionRequest();
        req.setPermissions(Set.of("candidatures:evaluate"));

        MvcResult result = mockMvc.perform(post("/api/auth/users/" + userId + "/permissions/grant")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UserDto dto = objectMapper.readValue(result.getResponse().getContentAsString(), UserDto.class);
        // allPermissions = role permissions + direct permissions
        assertThat(dto.getAllPermissions()).contains("candidatures:evaluate");
    }

    // ── POST /api/auth/users/{id}/permissions/revoke as admin ─────────────────

    @Test
    void revokePermissions_asAdmin_returns200() throws Exception {
        // Give the user two direct permissions up-front
        Permission candRead = perm("candidatures:read");
        Permission sessRead = perm("sessions:read");

        User user = User.builder()
                .email("user4@test.com")
                .firstName("Eve")
                .lastName("Wilson")
                .password(passwordEncoder.encode("pass1234"))
                .roles(new HashSet<>(Set.of(role("PORTEUR"))))
                .directPermissions(new HashSet<>(Set.of(candRead, sessRead)))
                .active(true)
                .build();
        user = userRepository.save(user);
        Long userId = user.getId();

        GrantPermissionRequest req = new GrantPermissionRequest();
        req.setPermissions(Set.of("sessions:read"));

        MvcResult result = mockMvc.perform(post("/api/auth/users/" + userId + "/permissions/revoke")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UserDto dto = objectMapper.readValue(result.getResponse().getContentAsString(), UserDto.class);
        // Direct permissions: sessions:read was revoked; candidatures:read remains
        assertThat(dto.getDirectPermissions()).contains("candidatures:read");
        assertThat(dto.getDirectPermissions()).doesNotContain("sessions:read");
    }

    // ── GET /api/auth/permissions as admin ────────────────────────────────────

    @Test
    void getPermissionCatalog_asAdmin_returns200WithMap() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, String> catalog = objectMapper.readValue(
                result.getResponse().getContentAsString(), Map.class);

        assertThat(catalog).isNotEmpty();
        assertThat(catalog).containsKey("users:read");
        assertThat(catalog).containsKey("candidatures:evaluate");
    }

    // ── GET /api/auth/roles as admin ──────────────────────────────────────────

    @Test
    void getRoleCatalog_asAdmin_returns200WithMap() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/roles")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, String> catalog = objectMapper.readValue(
                result.getResponse().getContentAsString(), Map.class);

        assertThat(catalog).isNotEmpty();
        assertThat(catalog).containsKey("ADMIN");
        assertThat(catalog).containsKey("PORTEUR");
    }

    // ── GET /api/auth/users as admin ──────────────────────────────────────────

    @Test
    void getUsers_asAdmin_returnsUserList() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        UserDto[] users = objectMapper.readValue(result.getResponse().getContentAsString(), UserDto[].class);
        assertThat(users).isNotEmpty();
        assertThat(users[0].getRoles()).isNotNull();
        assertThat(users[0].getAllPermissions()).isNotNull();
    }

    // ── Error handling: register duplicate email ───────────────────────────────

    @Test
    void register_duplicateEmail_returnsBadRequest() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("admin@test.com"); // already exists from setUp
        req.setFirstName("Other");
        req.setLastName("Person");
        req.setPassword("Password1!");
        req.setRole("CANDIDAT");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // ── Error handling: invalid role ──────────────────────────────────────────

    @Test
    void register_invalidRole_returnsBadRequest() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("bad@test.com");
        req.setFirstName("Bad");
        req.setLastName("Role");
        req.setPassword("Password1!");
        req.setRole("HACKER");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }
}
