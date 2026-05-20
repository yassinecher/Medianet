package com.medianet.auth.controller;

import com.medianet.auth.dto.*;
import com.medianet.auth.security.JwtService;
import com.medianet.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtService  jwtService;

    // ── Auth ──────────────────────────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@RequestHeader("Authorization") String authHeader) {
        String email = jwtService.extractEmail(authHeader.substring(7));
        return ResponseEntity.ok(authService.getUserByEmail(email));
    }

    @GetMapping("/validate")
    public ResponseEntity<UserDto> validate(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.getUserByEmail(jwtService.extractEmail(token)));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDto> updateProfile(@RequestAttribute("userId") Long userId,
                                                  @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(userId, request));
    }

    // ── User queries ──────────────────────────────────────────────────────────

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(authService.getAllUsers());
    }

    @GetMapping("/users/role/{role}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDto>> getUsersByRole(@PathVariable String role) {
        return ResponseEntity.ok(authService.getUsersByRole(role));
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(authService.getUserById(id));
    }

    @PatchMapping("/users/{id}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(authService.toggleActive(id));
    }

    // ── Role management ───────────────────────────────────────────────────────

    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> updateRole(@PathVariable Long id,
                                               @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(authService.updateRole(id, request.getRole()));
    }

    @PutMapping("/users/{id}/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> syncRoles(@PathVariable Long id,
                                              @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.syncRoles(id, request.getRoles()));
    }

    @PostMapping("/users/{id}/roles/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> assignRoles(@PathVariable Long id,
                                                @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.assignRoles(id, request.getRoles()));
    }

    @PostMapping("/users/{id}/roles/remove")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> removeRoles(@PathVariable Long id,
                                                @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.removeRoles(id, request.getRoles()));
    }

    // ── Permission management ─────────────────────────────────────────────────

    @GetMapping("/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> getPermissionCatalog() {
        return ResponseEntity.ok(authService.getPermissionCatalog());
    }

    @GetMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> getRoleCatalog() {
        return ResponseEntity.ok(authService.getRoleCatalog());
    }

    @PostMapping("/users/{id}/permissions/grant")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> grantPermissions(@PathVariable Long id,
                                                     @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.grantPermissions(id, request.getPermissions()));
    }

    @PostMapping("/users/{id}/permissions/revoke")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> revokePermissions(@PathVariable Long id,
                                                      @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.revokePermissions(id, request.getPermissions()));
    }

    @PutMapping("/users/{id}/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDto> syncPermissions(@PathVariable Long id,
                                                    @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.syncPermissions(id, request.getPermissions()));
    }

    // ── Role-specific profile endpoints ──────────────────────────────────────

    @PutMapping("/users/{id}/profile/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminProfileDto> updateAdminProfile(@PathVariable Long id,
                                                               @RequestBody UpdateAdminProfileRequest req) {
        return ResponseEntity.ok(authService.updateAdminProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/mentor")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MentorProfileDto> updateMentorProfile(@PathVariable Long id,
                                                                  @RequestBody UpdateMentorProfileRequest req) {
        return ResponseEntity.ok(authService.updateMentorProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/porteur")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PorteurProfileDto> updatePorteurProfile(@PathVariable Long id,
                                                                    @RequestBody UpdatePorteurProfileRequest req) {
        return ResponseEntity.ok(authService.updatePorteurProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/jury")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<JuryProfileDto> updateJuryProfile(@PathVariable Long id,
                                                              @RequestBody UpdateJuryProfileRequest req) {
        return ResponseEntity.ok(authService.updateJuryProfile(id, req));
    }

    /** Self-service: porteur updates their own profile */
    @PutMapping("/profile/porteur")
    public ResponseEntity<PorteurProfileDto> updateMyPorteurProfile(
            @RequestAttribute("userId") Long userId,
            @RequestBody UpdatePorteurProfileRequest req) {
        return ResponseEntity.ok(authService.updatePorteurProfile(userId, req));
    }

    /** Self-service: mentor updates their own profile */
    @PutMapping("/profile/mentor")
    public ResponseEntity<MentorProfileDto> updateMyMentorProfile(
            @RequestAttribute("userId") Long userId,
            @RequestBody UpdateMentorProfileRequest req) {
        return ResponseEntity.ok(authService.updateMentorProfile(userId, req));
    }

    /** Self-service: jury updates their own profile */
    @PutMapping("/profile/jury")
    public ResponseEntity<JuryProfileDto> updateMyJuryProfile(
            @RequestAttribute("userId") Long userId,
            @RequestBody UpdateJuryProfileRequest req) {
        return ResponseEntity.ok(authService.updateJuryProfile(userId, req));
    }
}
