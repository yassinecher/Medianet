package com.medianet.auth.service;

import com.medianet.auth.dto.*;
import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import com.medianet.auth.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository           userRepository;
    @Mock private RoleRepository           roleRepository;
    @Mock private PermissionRepository     permissionRepository;
    @Mock private AdminProfileRepository   adminProfileRepository;
    @Mock private MentorProfileRepository  mentorProfileRepository;
    @Mock private PorteurProfileRepository porteurProfileRepository;
    @Mock private JuryProfileRepository    juryProfileRepository;
    @Mock private PasswordEncoder          passwordEncoder;
    @Mock private JwtService               jwtService;

    @InjectMocks
    private AuthService authService;

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Role makeRole(String name) {
        return Role.builder().id(1L).name(name)
                .displayName(name).permissions(new HashSet<>()).build();
    }

    private User makeUser(Long id, String email, Set<Role> roles) {
        return User.builder()
                .id(id).email(email)
                .firstName("Test").lastName("User")
                .password("encoded")
                .roles(roles)
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_withSingleRole_savesCorrectly() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("porteur@test.com");
        req.setFirstName("Alice");
        req.setLastName("Martin");
        req.setPassword("Password1!");
        req.setRole("PORTEUR");

        Role porteurRole = makeRole("PORTEUR");

        when(userRepository.existsByEmail("porteur@test.com")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded");
        when(roleRepository.findByName("PORTEUR")).thenReturn(Optional.of(porteurRole));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(porteurProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        when(porteurProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(jwtService.generateToken(any())).thenReturn("jwt-token");

        AuthResponse response = authService.register(req);

        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getEmail()).isEqualTo("porteur@test.com");
        assertThat(response.getRoles()).contains("PORTEUR");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_withExistingEmail_throwsException() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("existing@test.com");
        req.setPassword("pass");

        when(userRepository.existsByEmail("existing@test.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email already in use");
    }

    @Test
    void register_defaultsToCANDIDAT_whenNoRoleProvided() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("new@test.com");
        req.setFirstName("Bob");
        req.setLastName("Smith");
        req.setPassword("pass");

        Role candidatRole = makeRole("CANDIDAT");

        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded");
        when(roleRepository.findByName("CANDIDAT")).thenReturn(Optional.of(candidatRole));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(jwtService.generateToken(any())).thenReturn("token");

        AuthResponse response = authService.register(req);
        assertThat(response.getRoles()).contains("CANDIDAT");
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_withCorrectCredentials_returnsToken() {
        Role adminRole = makeRole("ADMIN");
        User user = makeUser(1L, "admin@test.com", Set.of(adminRole));

        LoginRequest req = new LoginRequest();
        req.setEmail("admin@test.com");
        req.setPassword("password");

        when(userRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "encoded")).thenReturn(true);
        when(jwtService.generateToken(user)).thenReturn("jwt-token");

        AuthResponse response = authService.login(req);
        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getRoles()).contains("ADMIN");
    }

    @Test
    void login_withWrongPassword_throwsBadCredentials() {
        Role role = makeRole("CANDIDAT");
        User user = makeUser(1L, "u@test.com", Set.of(role));

        LoginRequest req = new LoginRequest();
        req.setEmail("u@test.com");
        req.setPassword("wrong");

        when(userRepository.findByEmail("u@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_withInactiveUser_throwsBadCredentials() {
        Role role = makeRole("PORTEUR");
        User user = makeUser(1L, "u@test.com", Set.of(role));
        user.setActive(false);

        LoginRequest req = new LoginRequest();
        req.setEmail("u@test.com");
        req.setPassword("pass");

        when(userRepository.findByEmail("u@test.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("disabled");
    }

    // ── role management ────────────────────────────────────────────────────────

    @Test
    void syncRoles_replacesExistingRoles() {
        Role adminRole = makeRole("ADMIN");
        Role juryRole  = makeRole("JURY");
        User user = makeUser(1L, "u@test.com", new HashSet<>(Set.of(adminRole)));

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(roleRepository.findByName("JURY")).thenReturn(Optional.of(juryRole));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(juryProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        when(juryProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        UserDto dto = authService.syncRoles(1L, Set.of("JURY"));
        assertThat(dto.getRoles()).containsExactly("JURY");
    }

    @Test
    void assignRoles_appendsWithoutRemoving() {
        Role adminRole  = makeRole("ADMIN");
        Role mentorRole = makeRole("MENTOR");
        User user = makeUser(1L, "u@test.com", new HashSet<>(Set.of(adminRole)));

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(roleRepository.findByName("MENTOR")).thenReturn(Optional.of(mentorRole));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(mentorProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        when(mentorProfileRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        UserDto dto = authService.assignRoles(1L, Set.of("MENTOR"));
        assertThat(dto.getRoles()).contains("ADMIN", "MENTOR");
    }

    @Test
    void removeRoles_removesSpecifiedRole() {
        Role adminRole  = makeRole("ADMIN");
        Role porteurRole = makeRole("PORTEUR");
        User user = makeUser(1L, "u@test.com", new HashSet<>(Set.of(adminRole, porteurRole)));

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        UserDto dto = authService.removeRoles(1L, Set.of("PORTEUR"));
        assertThat(dto.getRoles()).containsExactly("ADMIN");
    }

    // ── user queries ──────────────────────────────────────────────────────────

    @Test
    void getUserByEmail_returnsCorrectDto() {
        Role role = makeRole("PORTEUR");
        User user = makeUser(5L, "porteur@test.com", Set.of(role));

        when(userRepository.findByEmail("porteur@test.com")).thenReturn(Optional.of(user));

        UserDto dto = authService.getUserByEmail("porteur@test.com");
        assertThat(dto.getId()).isEqualTo(5L);
        assertThat(dto.getRoles()).contains("PORTEUR");
    }

    @Test
    void toggleActive_flipsBooleanField() {
        Role role = makeRole("CANDIDAT");
        User user = makeUser(2L, "u@test.com", Set.of(role));
        user.setActive(true);

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        UserDto dto = authService.toggleActive(2L);
        assertThat(dto.isActive()).isFalse();
    }
}
