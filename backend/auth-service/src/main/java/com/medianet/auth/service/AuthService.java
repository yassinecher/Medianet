package com.medianet.auth.service;

import com.medianet.auth.dto.*;
import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import com.medianet.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository           userRepository;
    private final RoleRepository           roleRepository;
    private final PermissionRepository     permissionRepository;
    private final AdminProfileRepository   adminProfileRepository;
    private final MentorProfileRepository  mentorProfileRepository;
    private final PorteurProfileRepository porteurProfileRepository;
    private final JuryProfileRepository    juryProfileRepository;
    private final CompanyRepository        companyRepository;
    private final OrganizationRepository   organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final OrgMemberInvitationRepository orgInvitationRepository;
    private final PasswordEncoder          passwordEncoder;
    private final JwtService               jwtService;
    private final NotificationClient       notificationClient;
    private final AuthEventService         authEventService;

    // ── Auth ─────────────────────────────────────────────────────────────────

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use");
        }

        // Self-registration is intentionally restricted to PORTEUR.
        // JURY and MENTOR accounts are created only by admin invitation
        // (see registerFromInvitation) or by an admin via the user panel.
        Set<String> roleNames = Set.of("PORTEUR");
        Set<Role> roles = resolveRoles(roleNames);

        User user = User.builder()
                .email(request.getEmail())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(roles)
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        userRepository.save(user);

        // Auto-create role profile placeholders
        ensureProfiles(user, roles);
        // Every porteur owns an organisation (their startup) from day one.
        ensurePorteurOrganization(user);

        String token = jwtService.generateToken(user);
        return buildAuthResponse(token, user);
    }

    // ── Org member invitations (token → account linked to the organisation) ────

    @Transactional(readOnly = true)
    public Map<String, Object> getOrgInvitation(String token) {
        OrgMemberInvitation inv = orgInvitationRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invitation introuvable ou expirée"));
        Map<String, Object> m = new HashMap<>();
        m.put("organizationName", inv.getOrganizationName());
        m.put("email", inv.getEmail());
        m.put("memberName", inv.getMemberName());
        m.put("status", inv.getStatus());
        m.put("alreadyAccepted", "ACCEPTED".equalsIgnoreCase(inv.getStatus()));
        return m;
    }

    /** Accept an org-member invitation: create the member's account (PORTEUR) and
     *  link it to the organisation member row. */
    public AuthResponse acceptOrgInvitation(String token, String firstName, String lastName, String password) {
        OrgMemberInvitation inv = orgInvitationRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invitation introuvable ou expirée"));
        if ("ACCEPTED".equalsIgnoreCase(inv.getStatus())) {
            throw new IllegalStateException("Cette invitation a déjà été utilisée. Connectez-vous.");
        }
        String email = inv.getEmail().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalStateException("Un compte existe déjà pour " + email + ". Connectez-vous.");
        }
        User user = User.builder()
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .password(passwordEncoder.encode(password))
                .roles(resolveRoles(Set.of("PORTEUR")))
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        userRepository.save(user);
        ensureProfiles(user, user.getRoles());

        // Link the organisation member row to the new account.
        if (inv.getMemberId() != null) {
            memberRepository.findById(inv.getMemberId()).ifPresent(mem -> {
                mem.setUserId(user.getId());
                // The member fills their own identity on accept — the porteur only
                // ever supplied an email, so set the real name now.
                mem.setFullName((firstName + " " + lastName).trim());
                memberRepository.save(mem);
            });
        }
        inv.setStatus("ACCEPTED");
        orgInvitationRepository.save(inv);

        return buildAuthResponse(jwtService.generateToken(user), user);
    }

    /**
     * Guarantee a porteur has at least one organisation. Called on registration
     * (self + invitation) so a porteur can immediately attach their startup to a
     * candidature. No-op for non-porteurs or porteurs who already own one.
     */
    private void ensurePorteurOrganization(User user) {
        if (!user.hasRole("PORTEUR")) return;
        if (!organizationRepository.findByCreatedByUserId(user.getId()).isEmpty()) return;
        String first = user.getFirstName();
        String name = (first != null && !first.isBlank()) ? "Organisation de " + first : "Mon organisation";
        organizationRepository.save(Organization.builder()
                .name(name)
                .type("STARTUP")
                .createdByUserId(user.getId())
                .internal(false)
                .build());
    }

    /**
     * Finish account creation from an invitation email.
     *
     * <p>The invitation carries both the recipient email and the target role,
     * so the recipient cannot pick either. The token is consumed on success.
     */
    public AuthResponse registerFromInvitation(RegisterFromInvitationRequest req) {
        Map<String, Object> invitation = notificationClient.getInvitationByToken(req.getToken());

        String status = (String) invitation.getOrDefault("status", "");
        if ("ACCEPTED".equalsIgnoreCase(status)) {
            throw new IllegalStateException("This invitation has already been used");
        }
        if ("DECLINED".equalsIgnoreCase(status)) {
            throw new IllegalStateException("This invitation was declined");
        }

        String email = (String) invitation.get("recipientEmail");
        String type  = (String) invitation.get("type");   // JURY | MENTOR | PORTEUR | …
        if (email == null || type == null) {
            throw new IllegalArgumentException("Invitation is missing recipient or role");
        }

        if (userRepository.existsByEmail(email)) {
            // Edge case: account already exists. Mark accepted and let them log in.
            notificationClient.markAccepted(req.getToken());
            throw new IllegalStateException("An account already exists for " + email + ". Please log in.");
        }

        // Role comes from the invitation — never from the request body.
        Set<Role> roles = resolveRoles(Set.of(type.toUpperCase()));

        User user = User.builder()
                .email(email.toLowerCase())
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .password(passwordEncoder.encode(req.getPassword()))
                .roles(roles)
                .directPermissions(new HashSet<>())
                .active(true)
                .build();
        userRepository.save(user);
        ensureProfiles(user, roles);
        // A porteur invited in also gets their organisation.
        ensurePorteurOrganization(user);

        // Optionally save the phone number on the role profile.
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            attachPhone(user, type, req.getPhone());
        }

        // Mark invitation as accepted (best-effort).
        notificationClient.markAccepted(req.getToken());

        String token = jwtService.generateToken(user);
        return buildAuthResponse(token, user);
    }

    private void attachPhone(User user, String role, String phone) {
        switch (role.toUpperCase()) {
            case "MENTOR" -> mentorProfileRepository.findByUserId(user.getId()).ifPresent(p -> {
                p.setLinkedInUrl(p.getLinkedInUrl()); // no-op to keep field shape; mentor profile has no phone yet
            });
            case "PORTEUR" -> porteurProfileRepository.findByUserId(user.getId()).ifPresent(p -> {
                p.setPhoneNumber(phone);
                porteurProfileRepository.save(p);
            });
            case "ADMIN" -> adminProfileRepository.findByUserId(user.getId()).ifPresent(p -> {
                p.setPhoneNumber(phone);
                adminProfileRepository.save(p);
            });
            default -> { /* JURY profile has no phone field — silently skip */ }
        }
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (!user.isActive()) throw new BadCredentialsException("Account is disabled");
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        String token = jwtService.generateToken(user);
        return buildAuthResponse(token, user);
    }

    // ── User reads ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UserDto getUserByEmail(String email) {
        return toDto(userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found")));
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        return toDto(findUser(id));
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto> getUsersByRole(String role) {
        return userRepository.findByRoleName(role.toUpperCase())
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    /** Admin edit of another user's basic data (name + email). */
    public UserDto adminUpdateUser(Long id, AdminUpdateUserRequest req) {
        User user = findUser(id);
        if (req.getFirstName() != null) user.setFirstName(req.getFirstName().trim());
        if (req.getLastName() != null)  user.setLastName(req.getLastName().trim());
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            String email = req.getEmail().trim().toLowerCase();
            if (!email.equalsIgnoreCase(user.getEmail())) {
                userRepository.findByEmail(email).ifPresent(other -> {
                    if (!other.getId().equals(id)) throw new IllegalArgumentException("Cet email est déjà utilisé");
                });
                user.setEmail(email);
            }
        }
        userRepository.save(user);
        return toDto(user);
    }

    // ── Role management ───────────────────────────────────────────────────────

    /** Legacy: set exactly one role */
    public UserDto updateRole(Long id, String roleName) {
        User user = findUser(id);
        Set<Role> newRoles = resolveRoles(Set.of(roleName.toUpperCase()));
        requireAdminForPrivilegedRoleChange(added(user, newRoles), removed(user, newRoles));
        user.getRoles().clear();
        user.getRoles().addAll(newRoles);
        userRepository.save(user);
        ensureProfiles(user, newRoles);
        ensurePorteurOrganization(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    /** Replace the full roles set */
    public UserDto syncRoles(Long id, Set<String> roleNames) {
        User user = findUser(id);
        Set<Role> newRoles = resolveRoles(toUpper(roleNames));
        requireAdminForPrivilegedRoleChange(added(user, newRoles), removed(user, newRoles));
        user.getRoles().clear();
        user.getRoles().addAll(newRoles);
        userRepository.save(user);
        ensureProfiles(user, newRoles);
        ensurePorteurOrganization(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    /** Append roles without removing existing */
    public UserDto assignRoles(Long id, Set<String> roleNames) {
        User user = findUser(id);
        Set<Role> toAdd = resolveRoles(toUpper(roleNames));
        requireAdminForPrivilegedRoleChange(added(user, toAdd), Set.of());
        user.getRoles().addAll(toAdd);
        userRepository.save(user);
        ensureProfiles(user, toAdd);
        ensurePorteurOrganization(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    /** Remove specific roles */
    public UserDto removeRoles(Long id, Set<String> roleNames) {
        User user = findUser(id);
        Set<String> upperNames = toUpper(roleNames);
        Set<Role> toRemove = user.getRoles().stream()
                .filter(r -> upperNames.contains(r.getName()))
                .collect(Collectors.toSet());
        requireAdminForPrivilegedRoleChange(Set.of(), toRemove);
        user.getRoles().removeIf(r -> upperNames.contains(r.getName()));
        userRepository.save(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    /** Roles the user would gain. */
    private static Set<Role> added(User user, Set<Role> target) {
        Set<Role> a = new HashSet<>(target);
        a.removeAll(user.getRoles());
        return a;
    }

    /** Roles the user would lose. */
    private static Set<Role> removed(User user, Set<Role> target) {
        Set<Role> r = new HashSet<>(user.getRoles());
        r.removeAll(target);
        return r;
    }

    /**
     * Privileged roles (ADMIN itself, or any role carrying ADMIN-scoped
     * permissions) can only be given or taken away by an administrator —
     * a non-admin user manager can neither escalate someone into the
     * back-office nor demote an administrator.
     */
    private void requireAdminForPrivilegedRoleChange(Set<Role> addedRoles, Set<Role> removedRoles) {
        if (PermissionUtils.callerIsAdmin()) return;
        List<String> privileged = java.util.stream.Stream.concat(addedRoles.stream(), removedRoles.stream())
                .filter(r -> "ADMIN".equals(r.getName())
                        // effective set: inherited admin permissions count too
                        || r.getEffectivePermissions().stream().anyMatch(Permission::isAdminScope))
                .map(Role::getName).distinct().sorted().toList();
        if (!privileged.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Seul un administrateur peut attribuer ou retirer un rôle disposant de permissions d'administration : "
                            + String.join(", ", privileged));
        }
    }

    // ── Direct permission management ──────────────────────────────────────────

    public UserDto grantPermissions(Long id, Set<String> slugs) {
        User user = findUser(id);
        Set<Permission> toGrant = resolvePermissions(PermissionUtils.expandWithRead(slugs));
        toGrant.removeAll(user.getDirectPermissions()); // only genuinely new grants are checked
        PermissionUtils.requireAdminToGrantAdminScope(toGrant);
        user.getDirectPermissions().addAll(toGrant);
        userRepository.save(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    public UserDto revokePermissions(Long id, Set<String> slugs) {
        User user = findUser(id);
        user.getDirectPermissions().removeIf(p -> slugs.contains(p.getSlug()));
        userRepository.save(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    public UserDto syncPermissions(Long id, Set<String> slugs) {
        User user = findUser(id);
        Set<String> expanded = PermissionUtils.expandWithRead(slugs);
        Set<Permission> target = expanded.isEmpty() ? new HashSet<>() : resolvePermissions(expanded);
        // Only the ADDED permissions need the admin-scope check: keeping an
        // admin-granted permission in place (or dropping it) is allowed.
        Set<Permission> addedPerms = new HashSet<>(target);
        addedPerms.removeAll(user.getDirectPermissions());
        PermissionUtils.requireAdminToGrantAdminScope(addedPerms);
        user.getDirectPermissions().clear();
        user.getDirectPermissions().addAll(target);
        userRepository.save(user);
        authEventService.permissionsChanged(user.getId());
        return toDto(user);
    }

    // ── Role-profile management ───────────────────────────────────────────────

    public AdminProfileDto updateAdminProfile(Long userId, UpdateAdminProfileRequest req) {
        User user = findUser(userId);
        AdminProfile p = adminProfileRepository.findByUserId(userId)
                .orElseGet(() -> AdminProfile.builder().user(user).build());
        if (req.getDepartment()  != null) p.setDepartment(req.getDepartment());
        if (req.getPhoneNumber() != null) p.setPhoneNumber(req.getPhoneNumber());
        if (req.getAdminLevel()  != null) p.setAdminLevel(req.getAdminLevel());
        return toAdminDto(adminProfileRepository.save(p));
    }

    public MentorProfileDto updateMentorProfile(Long userId, UpdateMentorProfileRequest req) {
        User user = findUser(userId);
        MentorProfile p = mentorProfileRepository.findByUserId(userId)
                .orElseGet(() -> MentorProfile.builder().user(user).build());
        if (req.getTitle()              != null) p.setTitle(req.getTitle());
        if (req.getBio()                != null) p.setBio(req.getBio());
        if (req.getExpertise()          != null) p.setExpertise(req.getExpertise());
        if (req.getSpecializations()    != null) p.setSpecializations(req.getSpecializations());
        if (req.getAvailability()       != null) p.setAvailability(req.getAvailability());
        if (req.getLinkedInUrl()        != null) p.setLinkedInUrl(req.getLinkedInUrl());
        if (req.getWebsite()            != null) p.setWebsite(req.getWebsite());
        if (req.getYearsOfExperience()  != null) p.setYearsOfExperience(req.getYearsOfExperience());
        return toMentorDto(mentorProfileRepository.save(p));
    }

    public PorteurProfileDto updatePorteurProfile(Long userId, UpdatePorteurProfileRequest req) {
        User user = findUser(userId);
        PorteurProfile p = porteurProfileRepository.findByUserId(userId)
                .orElseGet(() -> PorteurProfile.builder().user(user).build());
        if (req.getCompany()     != null) p.setCompany(req.getCompany());
        if (req.getSector()      != null) p.setSector(req.getSector());
        if (req.getCity()        != null) p.setCity(req.getCity());
        if (req.getPhoneNumber() != null) p.setPhoneNumber(req.getPhoneNumber());
        if (req.getWebsite()     != null) p.setWebsite(req.getWebsite());
        if (req.getLinkedInUrl() != null) p.setLinkedInUrl(req.getLinkedInUrl());
        if (req.getAvatarUrl()   != null) p.setAvatarUrl(req.getAvatarUrl());
        if (req.getHeadline()    != null) p.setHeadline(req.getHeadline());
        if (req.getTwitterUrl()  != null) p.setTwitterUrl(req.getTwitterUrl());
        if (req.getBio()         != null) p.setBio(req.getBio());
        return toPorteurDto(porteurProfileRepository.save(p));
    }

    public JuryProfileDto updateJuryProfile(Long userId, UpdateJuryProfileRequest req) {
        User user = findUser(userId);
        JuryProfile p = juryProfileRepository.findByUserId(userId)
                .orElseGet(() -> JuryProfile.builder().user(user).build());
        if (req.getTitle()       != null) p.setTitle(req.getTitle());
        if (req.getBio()         != null) p.setBio(req.getBio());
        if (req.getAffiliation() != null) p.setAffiliation(req.getAffiliation());
        if (req.getExpertise()   != null) p.setExpertise(req.getExpertise());
        if (req.getLinkedInUrl() != null) p.setLinkedInUrl(req.getLinkedInUrl());
        return toJuryDto(juryProfileRepository.save(p));
    }

    // ── Other user operations ─────────────────────────────────────────────────

    public UserDto updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUser(userId);
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            if (request.getCurrentPassword() == null ||
                    !passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
                throw new IllegalArgumentException("Mot de passe actuel incorrect");
            }
            if (request.getNewPassword().length() < 8) {
                throw new IllegalArgumentException("Le nouveau mot de passe doit contenir au moins 8 caractères");
            }
            user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        }
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        userRepository.save(user);
        return toDto(user);
    }

    public UserDto toggleActive(Long id) {
        User user = findUser(id);
        user.setActive(!user.isActive());
        userRepository.save(user);
        if (user.isActive()) {
            authEventService.permissionsChanged(user.getId());
        } else {
            authEventService.accountDisabled(user.getId());
        }
        return toDto(user);
    }

    /**
     * Re-issue a JWT from current DB state — used by live sessions after a
     * {@code permissions-changed} event so new roles/permissions take effect
     * without re-login.
     */
    @Transactional(readOnly = true)
    public AuthResponse refreshToken(Long userId) {
        User user = findUser(userId);
        if (!user.isActive()) throw new BadCredentialsException("Account is disabled");
        return buildAuthResponse(jwtService.generateToken(user), user);
    }

    /**
     * Grouped permission catalog: modules in ModuleCatalog order (plateforme
     * first, administration after) with labels, descriptions and scopes.
     */
    @Transactional(readOnly = true)
    public List<PermissionCatalogDto> getPermissionCatalog() {
        Map<String, List<Permission>> byModule = permissionRepository.findAll().stream()
                .collect(Collectors.groupingBy(p -> p.getSlug().split(":")[0]));

        List<PermissionCatalogDto> out = new ArrayList<>();
        for (ModuleCatalog.ModuleDef mod : ModuleCatalog.MODULES) {
            List<Permission> perms = byModule.get(mod.key());
            if (perms == null || perms.isEmpty()) continue;
            List<PermissionCatalogDto.Entry> entries = perms.stream()
                    .sorted(Comparator.comparing(p -> actionOrder(p.getSlug())))
                    .map(p -> PermissionCatalogDto.Entry.builder()
                            .slug(p.getSlug())
                            .action(p.getSlug().substring(p.getSlug().indexOf(':') + 1))
                            .label(p.getDisplayName())
                            .scope(p.getScope() == null ? mod.scope() : p.getScope())
                            .build())
                    .collect(Collectors.toList());
            out.add(PermissionCatalogDto.builder()
                    .key(mod.key())
                    .label(mod.label())
                    .description(mod.description())
                    .scope(mod.scope())
                    .permissions(entries)
                    .build());
        }
        return out;
    }

    /** read < create < update < delete < specials (alphabetical). */
    private static String actionOrder(String slug) {
        String action = slug.substring(slug.indexOf(':') + 1);
        return switch (action) {
            case "read" -> "0"; case "create" -> "1";
            case "update" -> "2"; case "delete" -> "3";
            default -> "4" + action;
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
    }

    /** Resolve role name strings to Role entities; create if missing (dev convenience) */
    private Set<Role> resolveRoles(Set<String> names) {
        Set<Role> result = new HashSet<>();
        for (String name : names) {
            String upper = name.toUpperCase();
            result.add(roleRepository.findByName(upper)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + upper)));
        }
        return result;
    }

    /** Resolve permission slugs to Permission entities */
    private Set<Permission> resolvePermissions(Set<String> slugs) {
        Set<Permission> result = new HashSet<>();
        for (String slug : slugs) {
            result.add(permissionRepository.findBySlug(slug)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown permission: " + slug)));
        }
        return result;
    }

    /**
     * Auto-create empty profile records for newly-assigned roles.
     * Existing profiles are never touched.
     */
    private void ensureProfiles(User user, Set<Role> roles) {
        for (Role r : roles) {
            switch (r.getName()) {
                case "ADMIN" -> {
                    if (adminProfileRepository.findByUserId(user.getId()).isEmpty()) {
                        adminProfileRepository.save(AdminProfile.builder().user(user).build());
                    }
                }
                case "MENTOR" -> {
                    if (mentorProfileRepository.findByUserId(user.getId()).isEmpty()) {
                        mentorProfileRepository.save(MentorProfile.builder().user(user).build());
                    }
                }
                case "PORTEUR" -> {
                    if (porteurProfileRepository.findByUserId(user.getId()).isEmpty()) {
                        porteurProfileRepository.save(PorteurProfile.builder().user(user).build());
                    }
                }
                case "JURY" -> {
                    if (juryProfileRepository.findByUserId(user.getId()).isEmpty()) {
                        juryProfileRepository.save(JuryProfile.builder().user(user).build());
                    }
                }
            }
        }
    }

    private AuthResponse buildAuthResponse(String token, User user) {
        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .roles(user.getRoleNames())
                .permissions(user.getAllPermissionSlugs())
                .role(user.getPrimaryRole())
                .build();
    }

    UserDto toDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .roles(user.getRoleNames())
                .directPermissions(user.getDirectPermissionSlugs())
                .allPermissions(user.getAllPermissionSlugs())
                .role(user.getPrimaryRole())
                .active(user.isActive())
                .createdAt(user.getCreatedAt())
                .adminProfile(user.getAdminProfile()   != null ? toAdminDto(user.getAdminProfile())   : null)
                .mentorProfile(user.getMentorProfile() != null ? toMentorDto(user.getMentorProfile()) : null)
                .porteurProfile(user.getPorteurProfile() != null ? toPorteurDto(user.getPorteurProfile()) : null)
                .juryProfile(user.getJuryProfile()     != null ? toJuryDto(user.getJuryProfile())     : null)
                .build();
    }

    // ── Profile mappers ───────────────────────────────────────────────────────

    private AdminProfileDto toAdminDto(AdminProfile p) {
        if (p == null) return null;
        return AdminProfileDto.builder()
                .id(p.getId()).department(p.getDepartment())
                .phoneNumber(p.getPhoneNumber()).adminLevel(p.getAdminLevel())
                .lastLoginAt(p.getLastLoginAt()).build();
    }

    private MentorProfileDto toMentorDto(MentorProfile p) {
        if (p == null) return null;
        return MentorProfileDto.builder()
                .id(p.getId()).title(p.getTitle()).bio(p.getBio())
                .expertise(p.getExpertise()).specializations(p.getSpecializations())
                .rating(p.getRating()).availability(p.getAvailability())
                .linkedInUrl(p.getLinkedInUrl()).website(p.getWebsite())
                .yearsOfExperience(p.getYearsOfExperience()).sessionCount(p.getSessionCount()).build();
    }

    private PorteurProfileDto toPorteurDto(PorteurProfile p) {
        if (p == null) return null;
        return PorteurProfileDto.builder()
                .id(p.getId()).company(p.getCompany()).sector(p.getSector())
                .city(p.getCity()).phoneNumber(p.getPhoneNumber())
                .website(p.getWebsite()).linkedInUrl(p.getLinkedInUrl())
                .avatarUrl(p.getAvatarUrl()).headline(p.getHeadline()).twitterUrl(p.getTwitterUrl())
                .bio(p.getBio()).candidatureCount(p.getCandidatureCount()).build();
    }

    private JuryProfileDto toJuryDto(JuryProfile p) {
        if (p == null) return null;
        return JuryProfileDto.builder()
                .id(p.getId()).title(p.getTitle()).bio(p.getBio())
                .affiliation(p.getAffiliation()).expertise(p.getExpertise())
                .linkedInUrl(p.getLinkedInUrl()).evaluationCount(p.getEvaluationCount())
                .averageScore(p.getAverageScore()).build();
    }

    private static Set<String> toUpper(Set<String> input) {
        Set<String> out = new HashSet<>();
        if (input != null) input.forEach(r -> out.add(r.toUpperCase()));
        return out;
    }

    // ── Company management ────────────────────────────────────────────────────

    /** Create a new company owned by the given porteur. */
    public CompanyDto createCompany(Long porteurId, CreateCompanyRequest req) {
        User porteur = userRepository.findById(porteurId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + porteurId));

        if (companyRepository.existsByPorteurIdAndNameIgnoreCase(porteurId, req.getName())) {
            throw new IllegalArgumentException("You already have a company named '" + req.getName() + "'");
        }

        Company company = Company.builder()
                .porteur(porteur)
                .name(req.getName())
                .sector(req.getSector())
                .stage(parseStage(req.getStage()))
                .description(req.getDescription())
                .city(req.getCity())
                .website(req.getWebsite())
                .linkedInUrl(req.getLinkedInUrl())
                .logoUrl(req.getLogoUrl())
                .teamSize(req.getTeamSize())
                .build();

        return toCompanyDto(companyRepository.save(company));
    }

    /** All active companies belonging to a porteur. */
    @Transactional(readOnly = true)
    public List<CompanyDto> getMyCompanies(Long porteurId) {
        return companyRepository.findByPorteurIdAndActiveTrue(porteurId)
                .stream().map(this::toCompanyDto).collect(Collectors.toList());
    }

    /** Single company by id — any authenticated user (used by other services). */
    @Transactional(readOnly = true)
    public CompanyDto getCompanyById(Long id) {
        Company c = companyRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + id));
        return toCompanyDto(c);
    }

    /** Update a company — caller must be the owner or an admin. */
    public CompanyDto updateCompany(Long companyId, Long callerId, boolean isAdmin, UpdateCompanyRequest req) {
        Company c = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + companyId));

        if (!isAdmin && !c.getPorteur().getId().equals(callerId)) {
            throw new SecurityException("You do not own this company");
        }

        if (req.getName()        != null) c.setName(req.getName());
        if (req.getSector()      != null) c.setSector(req.getSector());
        if (req.getStage()       != null) c.setStage(parseStage(req.getStage()));
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getCity()        != null) c.setCity(req.getCity());
        if (req.getWebsite()     != null) c.setWebsite(req.getWebsite());
        if (req.getLinkedInUrl() != null) c.setLinkedInUrl(req.getLinkedInUrl());
        if (req.getLogoUrl()     != null) c.setLogoUrl(req.getLogoUrl());
        if (req.getTeamSize()    != null) c.setTeamSize(req.getTeamSize());

        return toCompanyDto(companyRepository.save(c));
    }

    /** Soft-delete a company — caller must be owner or admin. */
    public void deleteCompany(Long companyId, Long callerId, boolean isAdmin) {
        Company c = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + companyId));

        if (!isAdmin && !c.getPorteur().getId().equals(callerId)) {
            throw new SecurityException("You do not own this company");
        }
        c.setActive(false);
        companyRepository.save(c);
    }

    /** Admin: list all active companies. */
    @Transactional(readOnly = true)
    public List<CompanyDto> getAllCompanies() {
        return companyRepository.findByActiveTrue()
                .stream().map(this::toCompanyDto).collect(Collectors.toList());
    }

    /** All companies (including inactive) for a given porteur — admin use. */
    @Transactional(readOnly = true)
    public List<CompanyDto> getCompaniesByPorteur(Long porteurId) {
        return companyRepository.findByPorteurId(porteurId)
                .stream().map(this::toCompanyDto).collect(Collectors.toList());
    }

    // ── Company mapper ────────────────────────────────────────────────────────

    private CompanyDto toCompanyDto(Company c) {
        return CompanyDto.builder()
                .id(c.getId())
                .name(c.getName())
                .sector(c.getSector())
                .stage(c.getStage() != null ? c.getStage().name() : null)
                .description(c.getDescription())
                .city(c.getCity())
                .website(c.getWebsite())
                .linkedInUrl(c.getLinkedInUrl())
                .logoUrl(c.getLogoUrl())
                .teamSize(c.getTeamSize())
                .active(c.getActive())
                .porteurId(c.getPorteur().getId())
                .porteurName(c.getPorteur().getFirstName() + " " + c.getPorteur().getLastName())
                .porteurEmail(c.getPorteur().getEmail())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private CompanyStage parseStage(String stage) {
        if (stage == null || stage.isBlank()) return CompanyStage.IDEA;
        try { return CompanyStage.valueOf(stage.toUpperCase()); }
        catch (IllegalArgumentException e) { return CompanyStage.IDEA; }
    }
}
