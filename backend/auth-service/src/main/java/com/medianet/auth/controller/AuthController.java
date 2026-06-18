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
import java.util.Set;

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

    // ── Org-member token invitations (public — the token is the authorization) ──

    @GetMapping("/org-invitations/{token}")
    public ResponseEntity<Map<String, Object>> getOrgInvitation(@PathVariable String token) {
        return ResponseEntity.ok(authService.getOrgInvitation(token));
    }

    @PostMapping("/org-invitations/{token}")
    public ResponseEntity<AuthResponse> acceptOrgInvitation(
            @PathVariable String token, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.acceptOrgInvitation(
                token,
                body.getOrDefault("firstName", ""),
                body.getOrDefault("lastName", ""),
                body.getOrDefault("password", "")));
    }

    /**
     * Finish account creation from an invitation email.
     * <p>Public — the invitation token itself is the proof of authorization.
     */
    @PostMapping("/register-from-invitation")
    public ResponseEntity<AuthResponse> registerFromInvitation(
            @Valid @RequestBody RegisterFromInvitationRequest req) {
        return ResponseEntity.ok(authService.registerFromInvitation(req));
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
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(authService.getAllUsers());
    }

    @GetMapping("/users/role/{role}")
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<List<UserDto>> getUsersByRole(@PathVariable String role) {
        return ResponseEntity.ok(authService.getUsersByRole(role));
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<UserDto> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(authService.getUserById(id));
    }

    /** Look up a user by email — used to detect an existing account before
     *  granting the JURY role. Returns 404 (not 500) when no account exists. */
    @GetMapping("/users/by-email")
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<UserDto> getUserByEmail(@RequestParam String email) {
        try {
            return ResponseEntity.ok(authService.getUserByEmail(email));
        } catch (RuntimeException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/users/{id}/toggle-active")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(authService.toggleActive(id));
    }

    /** Admin edit of a user's basic data (name + email). */
    @PutMapping("/users/{id}")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> adminUpdateUser(@PathVariable Long id,
                                                   @Valid @RequestBody AdminUpdateUserRequest request) {
        return ResponseEntity.ok(authService.adminUpdateUser(id, request));
    }

    // ── Role management ───────────────────────────────────────────────────────

    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> updateRole(@PathVariable Long id,
                                               @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(authService.updateRole(id, request.getRole()));
    }

    @PutMapping("/users/{id}/roles")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> syncRoles(@PathVariable Long id,
                                              @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.syncRoles(id, request.getRoles()));
    }

    @PostMapping("/users/{id}/roles/assign")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> assignRoles(@PathVariable Long id,
                                                @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.assignRoles(id, request.getRoles()));
    }

    @PostMapping("/users/{id}/roles/remove")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> removeRoles(@PathVariable Long id,
                                                @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(authService.removeRoles(id, request.getRoles()));
    }

    // ── Permission management ─────────────────────────────────────────────────

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<Map<String, String>> getPermissionCatalog() {
        return ResponseEntity.ok(authService.getPermissionCatalog());
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('users:read')")
    public ResponseEntity<Map<String, String>> getRoleCatalog() {
        return ResponseEntity.ok(authService.getRoleCatalog());
    }

    @PostMapping("/users/{id}/permissions/grant")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> grantPermissions(@PathVariable Long id,
                                                     @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.grantPermissions(id, request.getPermissions()));
    }

    @PostMapping("/users/{id}/permissions/revoke")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> revokePermissions(@PathVariable Long id,
                                                      @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.revokePermissions(id, request.getPermissions()));
    }

    @PutMapping("/users/{id}/permissions")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<UserDto> syncPermissions(@PathVariable Long id,
                                                    @Valid @RequestBody GrantPermissionRequest request) {
        return ResponseEntity.ok(authService.syncPermissions(id, request.getPermissions()));
    }

    // ── Role-specific profile endpoints ──────────────────────────────────────

    @PutMapping("/users/{id}/profile/admin")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<AdminProfileDto> updateAdminProfile(@PathVariable Long id,
                                                               @RequestBody UpdateAdminProfileRequest req) {
        return ResponseEntity.ok(authService.updateAdminProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/mentor")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<MentorProfileDto> updateMentorProfile(@PathVariable Long id,
                                                                  @RequestBody UpdateMentorProfileRequest req) {
        return ResponseEntity.ok(authService.updateMentorProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/porteur")
    @PreAuthorize("hasAuthority('users:update')")
    public ResponseEntity<PorteurProfileDto> updatePorteurProfile(@PathVariable Long id,
                                                                    @RequestBody UpdatePorteurProfileRequest req) {
        return ResponseEntity.ok(authService.updatePorteurProfile(id, req));
    }

    @PutMapping("/users/{id}/profile/jury")
    @PreAuthorize("hasAuthority('users:update')")
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

    // ── AI-service helpers (any authenticated caller) ─────────────────────────

    /** Returns all active mentor users — used by ai-matching-service. */
    @GetMapping("/mentors")
    public ResponseEntity<List<UserDto>> getAvailableMentors() {
        return ResponseEntity.ok(authService.getUsersByRole("MENTOR"));
    }

    // ── Company endpoints ─────────────────────────────────────────────────────

    /**
     * Create a new company.
     * The caller must be authenticated (any role can own a company, but
     * typically PORTEUR). porteurId is taken from the JWT — no spoofing.
     */
    @PostMapping("/companies")
    public ResponseEntity<CompanyDto> createCompany(
            @RequestAttribute("userId") Long userId,
            @Valid @RequestBody CreateCompanyRequest req) {
        return ResponseEntity.status(201).body(authService.createCompany(userId, req));
    }

    /** List the caller's own companies (active). */
    @GetMapping("/companies/mine")
    public ResponseEntity<List<CompanyDto>> getMyCompanies(
            @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(authService.getMyCompanies(userId));
    }

    /**
     * Get a single company by id.
     * Any authenticated user may call this (used by programme-service etc.).
     */
    @GetMapping("/companies/{id}")
    public ResponseEntity<CompanyDto> getCompanyById(@PathVariable Long id) {
        return ResponseEntity.ok(authService.getCompanyById(id));
    }

    /**
     * Update a company.
     * The caller must be the owner OR an admin.
     */
    @SuppressWarnings("unchecked")
    @PutMapping("/companies/{id}")
    public ResponseEntity<CompanyDto> updateCompany(
            @PathVariable Long id,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRoles", required = false) Object userRoles,
            @Valid @RequestBody UpdateCompanyRequest req) {
        boolean isAdmin = userRoles instanceof Set<?> s && s.contains("ADMIN");
        return ResponseEntity.ok(authService.updateCompany(id, userId, isAdmin, req));
    }

    /**
     * Soft-delete a company.
     * The caller must be the owner OR an admin.
     */
    @SuppressWarnings("unchecked")
    @DeleteMapping("/companies/{id}")
    public ResponseEntity<Void> deleteCompany(
            @PathVariable Long id,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRoles", required = false) Object userRoles) {
        boolean isAdmin = userRoles instanceof Set<?> s && s.contains("ADMIN");
        authService.deleteCompany(id, userId, isAdmin);
        return ResponseEntity.noContent().build();
    }

    /** Admin: list all active companies. */
    @GetMapping("/admin/companies")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<CompanyDto>> getAllCompanies() {
        return ResponseEntity.ok(authService.getAllCompanies());
    }

    /** Admin: list all companies (including inactive) for a specific porteur. */
    @GetMapping("/admin/companies/porteur/{porteurId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<CompanyDto>> getCompaniesByPorteur(@PathVariable Long porteurId) {
        return ResponseEntity.ok(authService.getCompaniesByPorteur(porteurId));
    }
}
