package com.medianet.auth.service;

import com.medianet.auth.dto.*;
import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class OrganizationService {

    private final OrganizationRepository       orgRepository;
    private final OrganizationMemberRepository memberRepository;
    private final OrgMemberInvitationRepository invitationRepository;
    private final UserRepository               userRepository;
    private final NotificationClient           notificationClient;

    @Value("${frontoffice.url:http://localhost:3000}")
    private String frontofficeUrl;

    // ── Organisations ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrganizationDto> list(String type, Boolean internal, Long createdByUserId, Long memberUserId) {
        List<Organization> rows;
        if (memberUserId != null) {
            // Organisations where this user is a TEAM MEMBER (read-only view).
            rows = memberRepository.findByUserId(memberUserId).stream()
                    .map(OrganizationMember::getOrganization)
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.collectingAndThen(
                        Collectors.toMap(Organization::getId, o -> o, (a, b) -> a, java.util.LinkedHashMap::new),
                        m -> new ArrayList<>(m.values())));
        } else if (createdByUserId != null) {
            rows = orgRepository.findByCreatedByUserId(createdByUserId);
        } else if (type != null) {
            rows = orgRepository.findByType(type);
        } else if (Boolean.TRUE.equals(internal)) {
            rows = orgRepository.findByInternalTrue();
        } else {
            rows = orgRepository.findAll();
        }
        return rows.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrganizationDto get(Long id) {
        return toDto(findOrThrow(id));
    }

    /** Read with access control: only related people may view an organisation —
     *  its owner, its members, or a privileged viewer (ADMIN / JURY). */
    @Transactional(readOnly = true)
    public OrganizationDto get(Long id, Long viewerUserId, boolean privileged) {
        Organization o = findOrThrow(id);
        assertCanView(o, viewerUserId, privileged);
        return toDto(o);
    }

    @Transactional(readOnly = true)
    public List<OrganizationMemberDto> listMembers(Long organizationId, Long viewerUserId, boolean privileged) {
        Organization o = findOrThrow(organizationId);
        assertCanView(o, viewerUserId, privileged);
        return o.getMembers() == null ? new ArrayList<>()
                : o.getMembers().stream().map(this::toMemberDto).collect(Collectors.toList());
    }

    private void assertCanView(Organization o, Long viewerUserId, boolean privileged) {
        if (privileged) return; // ADMIN / JURY — trusted reviewers
        boolean related = viewerUserId != null && (
                viewerUserId.equals(o.getCreatedByUserId()) ||
                (o.getMembers() != null && o.getMembers().stream()
                        .anyMatch(m -> viewerUserId.equals(m.getUserId()))));
        if (!related) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous n'avez pas accès à cette organisation.");
        }
    }

    public OrganizationDto create(CreateOrganizationRequest req, Long currentUserId) {
        Organization o = Organization.builder()
                .name(req.getName())
                .type(normalizeType(req.getType()))
                .description(req.getDescription())
                .sector(req.getSector())
                .city(req.getCity())
                .country(req.getCountry())
                .address(req.getAddress())
                .website(req.getWebsite())
                .contactEmail(req.getContactEmail())
                .contactPhone(req.getContactPhone())
                .foundedYear(req.getFoundedYear())
                .employeeCount(req.getEmployeeCount())
                .logoUrl(req.getLogoUrl())
                .internal(Boolean.TRUE.equals(req.getInternal()))
                .linkedCompanyId(req.getLinkedCompanyId())
                .createdByUserId(currentUserId)
                .build();
        return toDto(orgRepository.save(o));
    }

    public OrganizationDto update(Long id, UpdateOrganizationRequest req) {
        Organization o = findOrThrow(id);
        if (req.getName()           != null) o.setName(req.getName());
        if (req.getType()           != null) o.setType(normalizeType(req.getType()));
        if (req.getDescription()    != null) o.setDescription(req.getDescription());
        if (req.getSector()         != null) o.setSector(req.getSector());
        if (req.getCity()           != null) o.setCity(req.getCity());
        if (req.getCountry()        != null) o.setCountry(req.getCountry());
        if (req.getAddress()        != null) o.setAddress(req.getAddress());
        if (req.getWebsite()        != null) o.setWebsite(req.getWebsite());
        if (req.getContactEmail()   != null) o.setContactEmail(req.getContactEmail());
        if (req.getContactPhone()   != null) o.setContactPhone(req.getContactPhone());
        if (req.getFoundedYear()    != null) o.setFoundedYear(req.getFoundedYear());
        if (req.getEmployeeCount()  != null) o.setEmployeeCount(req.getEmployeeCount());
        if (req.getLogoUrl()        != null) o.setLogoUrl(req.getLogoUrl());
        if (req.getInternal()       != null) o.setInternal(req.getInternal());
        if (req.getLinkedCompanyId()!= null) o.setLinkedCompanyId(req.getLinkedCompanyId());
        return toDto(orgRepository.save(o));
    }

    public void delete(Long id) {
        orgRepository.delete(findOrThrow(id));
    }

    // ── Members ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrganizationMemberDto> listMembers(Long organizationId) {
        findOrThrow(organizationId);
        return memberRepository.findByOrganization_Id(organizationId)
                .stream().map(this::toMemberDto).collect(Collectors.toList());
    }

    public OrganizationMemberDto addMember(Long organizationId, CreateOrganizationMemberRequest req) {
        Organization o = findOrThrow(organizationId);
        // Invite-only flow: the porteur supplies an email; the member fills their
        // own details after accepting. Default the (non-null) name from the email.
        String fullName = (req.getFullName() != null && !req.getFullName().isBlank())
                ? req.getFullName().trim()
                : deriveName(req.getEmail());
        OrganizationMember m = OrganizationMember.builder()
                .organization(o)
                .userId(req.getUserId())
                .fullName(fullName)
                .email(req.getEmail())
                .phone(req.getPhone())
                .avatarUrl(req.getAvatarUrl())
                .headline(req.getHeadline())
                .linkedInUrl(req.getLinkedInUrl())
                .role(req.getRole())
                .responsibilities(req.getResponsibilities())
                .expertise(req.getExpertise() != null ? req.getExpertise() : new ArrayList<>())
                .type(parseMemberType(req.getType()))
                .build();
        OrganizationMember saved = memberRepository.save(m);
        // Token email invitation: only when an email is given and the member is
        // not already a platform user (no need to invite an existing account).
        if (saved.getEmail() != null && !saved.getEmail().isBlank() && saved.getUserId() == null) {
            inviteMemberByEmail(o, saved);
        }
        return toMemberDto(saved);
    }

    /** Create a token invitation for a new member and email them a join link. */
    private void inviteMemberByEmail(Organization o, OrganizationMember m) {
        // Skip if the email already has an account — just link it instead.
        userRepository.findByEmail(m.getEmail().toLowerCase()).ifPresentOrElse(u -> {
            m.setUserId(u.getId());
            memberRepository.save(m);
        }, () -> {
            OrgMemberInvitation inv = invitationRepository.save(OrgMemberInvitation.builder()
                    .token(UUID.randomUUID().toString())
                    .organizationId(o.getId())
                    .organizationName(o.getName())
                    .memberId(m.getId())
                    .memberName(m.getFullName())
                    .email(m.getEmail())
                    .status("PENDING")
                    .build());
            String link = frontofficeUrl + "/join/" + inv.getToken();
            String roleLine = (m.getRole() != null && !m.getRole().isBlank())
                    ? " en tant que <b>" + escape(m.getRole()) + "</b>" : "";
            String html = "<div style=\"font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:auto;color:#0f172a;line-height:1.5\">"
                    + "<p style=\"font-size:13px;color:#64748b;margin:0 0 16px\">Medianet Incubateur</p>"
                    + "<p>Bonjour " + escape(m.getFullName()) + ",</p>"
                    + "<p>" + escape(o.getName()) + " vous a ajouté(e) à son équipe" + roleLine
                    + " sur la plateforme Medianet Incubateur. Pour accéder à l'espace de l'organisation, "
                    + "activez votre compte avec le lien ci-dessous :</p>"
                    + "<p style=\"margin:24px 0\"><a href=\"" + link
                    + "\" style=\"background:#2563eb;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block\">Activer mon compte</a></p>"
                    + "<p style=\"color:#64748b;font-size:13px\">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>"
                    + "<span style=\"color:#2563eb\">" + link + "</span></p>"
                    + "<hr style=\"border:none;border-top:1px solid #e2e8f0;margin:24px 0\">"
                    + "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Vous recevez cet email car votre adresse a été renseignée comme membre de l'équipe « "
                    + escape(o.getName()) + " ». Si vous n'attendiez pas cette invitation, ignorez ce message.</p></div>";
            notificationClient.sendEmail(m.getEmail(), m.getFullName(),
                    o.getName() + " vous invite à rejoindre son équipe", html);
        });
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    public OrganizationMemberDto updateMember(Long organizationId, Long memberId,
                                              UpdateOrganizationMemberRequest req) {
        OrganizationMember m = findMember(organizationId, memberId);
        if (req.getUserId()          != null) m.setUserId(req.getUserId());
        if (req.getFullName()        != null) m.setFullName(req.getFullName());
        if (req.getEmail()           != null) m.setEmail(req.getEmail());
        if (req.getPhone()           != null) m.setPhone(req.getPhone());
        if (req.getAvatarUrl()       != null) m.setAvatarUrl(req.getAvatarUrl());
        if (req.getHeadline()        != null) m.setHeadline(req.getHeadline());
        if (req.getLinkedInUrl()     != null) m.setLinkedInUrl(req.getLinkedInUrl());
        if (req.getRole()            != null) m.setRole(req.getRole());
        if (req.getResponsibilities()!= null) m.setResponsibilities(req.getResponsibilities());
        if (req.getExpertise()       != null) m.setExpertise(req.getExpertise());
        if (req.getType()            != null) m.setType(parseMemberType(req.getType()));
        return toMemberDto(memberRepository.save(m));
    }

    /** Remove a member from the org. This does NOT delete their account — only the
     *  membership row — and cancels any pending invitation token. */
    public void removeMember(Long organizationId, Long memberId) {
        OrganizationMember m = findMember(organizationId, memberId);
        invitationRepository.deleteByMemberId(memberId); // cancel pending/used token
        memberRepository.delete(m);
    }

    /** Derive a friendly placeholder name from an email's local part. */
    private static String deriveName(String email) {
        if (email == null || email.isBlank()) return "Membre invité";
        String local = email.split("@")[0].replaceAll("[._-]+", " ").trim();
        if (local.isEmpty()) return "Membre invité";
        return java.util.Arrays.stream(local.split(" "))
                .filter(s -> !s.isEmpty())
                .map(s -> Character.toUpperCase(s.charAt(0)) + s.substring(1))
                .collect(java.util.stream.Collectors.joining(" "));
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    private OrganizationDto toDto(Organization o) {
        return OrganizationDto.builder()
                .id(o.getId())
                .name(o.getName())
                .type(o.getType() != null ? o.getType() : "STARTUP")
                .description(o.getDescription())
                .sector(o.getSector())
                .city(o.getCity())
                .country(o.getCountry())
                .address(o.getAddress())
                .website(o.getWebsite())
                .contactEmail(o.getContactEmail())
                .contactPhone(o.getContactPhone())
                .foundedYear(o.getFoundedYear())
                .employeeCount(o.getEmployeeCount())
                .logoUrl(o.getLogoUrl())
                .internal(o.getInternal())
                .showcased(Boolean.TRUE.equals(o.getShowcased()))
                .createdByUserId(o.getCreatedByUserId())
                .linkedCompanyId(o.getLinkedCompanyId())
                .createdAt(o.getCreatedAt())
                .updatedAt(o.getUpdatedAt())
                .members(o.getMembers() == null
                        ? new ArrayList<>()
                        : o.getMembers().stream().map(this::toMemberDto).collect(Collectors.toList()))
                .build();
    }

    private OrganizationMemberDto toMemberDto(OrganizationMember m) {
        return OrganizationMemberDto.builder()
                .id(m.getId())
                .userId(m.getUserId())
                .fullName(m.getFullName())
                .email(m.getEmail())
                .phone(m.getPhone())
                .avatarUrl(m.getAvatarUrl())
                .headline(m.getHeadline())
                .linkedInUrl(m.getLinkedInUrl())
                .role(m.getRole())
                .responsibilities(m.getResponsibilities())
                .expertise(m.getExpertise() != null ? new ArrayList<>(m.getExpertise()) : new ArrayList<>())
                .type(m.getType() != null ? m.getType().name() : MemberType.INTERNAL.name())
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Organization findOrThrow(Long id) {
        return orgRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found: " + id));
    }

    private OrganizationMember findMember(Long organizationId, Long memberId) {
        OrganizationMember m = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found: " + memberId));
        if (!m.getOrganization().getId().equals(organizationId)) {
            throw new IllegalArgumentException("Member does not belong to organization " + organizationId);
        }
        return m;
    }

    /** Org type is now a free string (admin-managed catalogue). Default STARTUP. */
    private String normalizeType(String s) {
        return (s == null || s.isBlank()) ? "STARTUP" : s.trim();
    }

    private MemberType parseMemberType(String s) {
        if (s == null || s.isBlank()) return MemberType.INTERNAL;
        try { return MemberType.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid member type: " + s); }
    }
}
