package com.medianet.programme.controller;

import com.medianet.programme.entity.IncubatedCompany;
import com.medianet.programme.repository.IncubatedCompanyRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Admin-managed catalogue of already-incubated companies + its public listing
 * for the frontoffice « Sociétés incubées » page.
 */
@RestController
@RequiredArgsConstructor
public class IncubatedCompanyController {

    private final IncubatedCompanyRepository repository;

    @Data @Builder
    public static class Dto {
        private Long id;
        private String name;
        private String logoUrl;
        private String description;
        private String website;
        private String sector;
        private String cohortYear;
        private boolean publicVisible;
        private Integer sortOrder;
        private LocalDateTime createdAt;
    }

    @Data
    public static class UpsertRequest {
        private String name;
        private String logoUrl;
        private String description;
        private String website;
        private String sector;
        private String cohortYear;
        private Boolean publicVisible;
        private Integer sortOrder;
    }

    // ── Admin management ──────────────────────────────────────────────────────

    @GetMapping("/api/incubated-companies")
    public ResponseEntity<List<Dto>> list() {
        return ResponseEntity.ok(sorted(repository.findAll()));
    }

    @PostMapping("/api/incubated-companies")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Dto> create(@RequestBody UpsertRequest req) {
        if (req.getName() == null || req.getName().isBlank()) {
            throw new IllegalArgumentException("Le nom de la société est requis");
        }
        IncubatedCompany c = IncubatedCompany.builder()
                .name(req.getName().trim())
                .logoUrl(req.getLogoUrl())
                .description(req.getDescription())
                .website(req.getWebsite())
                .sector(req.getSector())
                .cohortYear(req.getCohortYear())
                .publicVisible(req.getPublicVisible())
                .sortOrder(req.getSortOrder())
                .build();
        return ResponseEntity.status(201).body(toDto(repository.save(c)));
    }

    @PutMapping("/api/incubated-companies/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Dto> update(@PathVariable Long id, @RequestBody UpsertRequest req) {
        IncubatedCompany c = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Société introuvable : " + id));
        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getLogoUrl() != null)       c.setLogoUrl(req.getLogoUrl());
        if (req.getDescription() != null)   c.setDescription(req.getDescription());
        if (req.getWebsite() != null)       c.setWebsite(req.getWebsite());
        if (req.getSector() != null)        c.setSector(req.getSector());
        if (req.getCohortYear() != null)    c.setCohortYear(req.getCohortYear());
        if (req.getPublicVisible() != null) c.setPublicVisible(req.getPublicVisible());
        if (req.getSortOrder() != null)     c.setSortOrder(req.getSortOrder());
        return ResponseEntity.ok(toDto(repository.save(c)));
    }

    @DeleteMapping("/api/incubated-companies/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── PUBLIC listing (no auth — only companies made visible) ────────────────

    @GetMapping("/api/incubated-companies/public")
    public ResponseEntity<List<Dto>> publicList() {
        return ResponseEntity.ok(sorted(repository.findAll()).stream()
                .filter(Dto::isPublicVisible)
                .collect(Collectors.toList()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Dto> sorted(List<IncubatedCompany> all) {
        return all.stream()
                .sorted(Comparator
                        .comparing((IncubatedCompany c) -> c.getSortOrder() == null ? Integer.MAX_VALUE : c.getSortOrder())
                        .thenComparing(c -> c.getName() == null ? "" : c.getName().toLowerCase()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private Dto toDto(IncubatedCompany c) {
        return Dto.builder()
                .id(c.getId())
                .name(c.getName())
                .logoUrl(c.getLogoUrl())
                .description(c.getDescription())
                .website(c.getWebsite())
                .sector(c.getSector())
                .cohortYear(c.getCohortYear())
                .publicVisible(Boolean.TRUE.equals(c.getPublicVisible()))
                .sortOrder(c.getSortOrder())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
