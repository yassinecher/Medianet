package com.medianet.auth.service;

import com.medianet.auth.dto.*;
import com.medianet.auth.entity.*;
import com.medianet.auth.repository.*;
import lombok.RequiredArgsConstructor;
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

    // ── Organisations ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrganizationDto> list(String type, Boolean internal, Long createdByUserId) {
        List<Organization> rows;
        if (createdByUserId != null) {
            rows = orgRepository.findByCreatedByUserId(createdByUserId);
        } else if (type != null) {
            rows = orgRepository.findByType(parseType(type));
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

    public OrganizationDto create(CreateOrganizationRequest req, Long currentUserId) {
        Organization o = Organization.builder()
                .name(req.getName())
                .type(parseType(req.getType()))
                .description(req.getDescription())
                .sector(req.getSector())
                .city(req.getCity())
                .country(req.getCountry())
                .website(req.getWebsite())
                .contactEmail(req.getContactEmail())
                .contactPhone(req.getContactPhone())
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
        if (req.getType()           != null) o.setType(parseType(req.getType()));
        if (req.getDescription()    != null) o.setDescription(req.getDescription());
        if (req.getSector()         != null) o.setSector(req.getSector());
        if (req.getCity()           != null) o.setCity(req.getCity());
        if (req.getCountry()        != null) o.setCountry(req.getCountry());
        if (req.getWebsite()        != null) o.setWebsite(req.getWebsite());
        if (req.getContactEmail()   != null) o.setContactEmail(req.getContactEmail());
        if (req.getContactPhone()   != null) o.setContactPhone(req.getContactPhone());
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
        OrganizationMember m = OrganizationMember.builder()
                .organization(o)
                .userId(req.getUserId())
                .fullName(req.getFullName())
                .email(req.getEmail())
                .phone(req.getPhone())
                .role(req.getRole())
                .responsibilities(req.getResponsibilities())
                .expertise(req.getExpertise() != null ? req.getExpertise() : new ArrayList<>())
                .type(parseMemberType(req.getType()))
                .build();
        return toMemberDto(memberRepository.save(m));
    }

    public OrganizationMemberDto updateMember(Long organizationId, Long memberId,
                                              UpdateOrganizationMemberRequest req) {
        OrganizationMember m = findMember(organizationId, memberId);
        if (req.getUserId()          != null) m.setUserId(req.getUserId());
        if (req.getFullName()        != null) m.setFullName(req.getFullName());
        if (req.getEmail()           != null) m.setEmail(req.getEmail());
        if (req.getPhone()           != null) m.setPhone(req.getPhone());
        if (req.getRole()            != null) m.setRole(req.getRole());
        if (req.getResponsibilities()!= null) m.setResponsibilities(req.getResponsibilities());
        if (req.getExpertise()       != null) m.setExpertise(req.getExpertise());
        if (req.getType()            != null) m.setType(parseMemberType(req.getType()));
        return toMemberDto(memberRepository.save(m));
    }

    public void removeMember(Long organizationId, Long memberId) {
        memberRepository.delete(findMember(organizationId, memberId));
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    private OrganizationDto toDto(Organization o) {
        return OrganizationDto.builder()
                .id(o.getId())
                .name(o.getName())
                .type(o.getType() != null ? o.getType().name() : OrganizationType.STARTUP.name())
                .description(o.getDescription())
                .sector(o.getSector())
                .city(o.getCity())
                .country(o.getCountry())
                .website(o.getWebsite())
                .contactEmail(o.getContactEmail())
                .contactPhone(o.getContactPhone())
                .logoUrl(o.getLogoUrl())
                .internal(o.getInternal())
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

    private OrganizationType parseType(String s) {
        if (s == null || s.isBlank()) return OrganizationType.STARTUP;
        try { return OrganizationType.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid organization type: " + s); }
    }

    private MemberType parseMemberType(String s) {
        if (s == null || s.isBlank()) return MemberType.INTERNAL;
        try { return MemberType.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid member type: " + s); }
    }
}
