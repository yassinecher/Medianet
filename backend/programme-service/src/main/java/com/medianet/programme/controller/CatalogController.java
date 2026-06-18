package com.medianet.programme.controller;

import com.medianet.programme.entity.CatalogValue;
import com.medianet.programme.repository.CatalogValueRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Admin-managed reference lists (taxonomies): organisation types, programme
 * sectors, … Any authenticated user may read a category (to fill dropdowns);
 * only admins create/update/delete options.
 */
@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogValueRepository repo;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CatalogRequest {
        private String category;            // required on create; ignored on update
        @NotBlank private String value;
        private String  label;
        private Integer sortOrder;
        private Boolean active;
    }

    @Data @Builder
    public static class CatalogDto {
        private Long id;
        private String category;
        private String value;
        private String label;
        private Integer sortOrder;
        private Boolean active;
    }

    /** List a category's values (all, ordered) — used by admin + form dropdowns. */
    @GetMapping
    public ResponseEntity<List<CatalogDto>> list(@RequestParam String category) {
        return ResponseEntity.ok(repo.findByCategoryOrderBySortOrderAscIdAsc(category)
                .stream().map(this::toDto).collect(Collectors.toList()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('settings:update')")
    public ResponseEntity<CatalogDto> create(@jakarta.validation.Valid @RequestBody CatalogRequest req) {
        String category = req.getCategory() == null ? "" : req.getCategory().trim();
        String value = req.getValue().trim();
        if (category.isBlank()) throw new IllegalArgumentException("category requis");
        if (repo.existsByCategoryAndValue(category, value))
            throw new IllegalArgumentException("Cette valeur existe déjà dans ce catalogue.");
        CatalogValue cv = repo.save(CatalogValue.builder()
                .category(category)
                .value(value)
                .label(req.getLabel() != null && !req.getLabel().isBlank() ? req.getLabel().trim() : value)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : (int) repo.countByCategory(category))
                .active(req.getActive() == null || req.getActive())
                .build());
        return ResponseEntity.status(201).body(toDto(cv));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('settings:update')")
    public ResponseEntity<CatalogDto> update(@PathVariable Long id, @RequestBody CatalogRequest req) {
        CatalogValue cv = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Valeur introuvable"));
        if (req.getLabel()     != null) cv.setLabel(req.getLabel().trim());
        if (req.getValue()     != null && !req.getValue().isBlank()) cv.setValue(req.getValue().trim());
        if (req.getSortOrder() != null) cv.setSortOrder(req.getSortOrder());
        if (req.getActive()    != null) cv.setActive(req.getActive());
        return ResponseEntity.ok(toDto(repo.save(cv)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('settings:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private CatalogDto toDto(CatalogValue c) {
        return CatalogDto.builder()
                .id(c.getId()).category(c.getCategory()).value(c.getValue())
                .label(c.getLabel()).sortOrder(c.getSortOrder()).active(c.getActive())
                .build();
    }
}
