package com.medianet.programme.controller;

import com.medianet.programme.entity.ParcoursTemplate;
import com.medianet.programme.repository.ParcoursTemplateRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/** Reusable named PARCOURS templates (full session structures, relative dates). */
@RestController
@RequestMapping("/api/parcours-templates")
@RequiredArgsConstructor
public class ParcoursTemplateController {

    private final ParcoursTemplateRepository repo;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class TemplateRequest {
        @NotBlank private String name;
        private String structureJson;
        private Integer sessionCount;
    }

    @Data @Builder
    public static class TemplateDto {
        private Long id;
        private String name;
        private String structureJson;
        private Integer sessionCount;
        private LocalDateTime createdAt;
    }

    @GetMapping
    public ResponseEntity<List<TemplateDto>> list() {
        return ResponseEntity.ok(
                repo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).collect(Collectors.toList()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<TemplateDto> create(@jakarta.validation.Valid @RequestBody TemplateRequest req) {
        ParcoursTemplate t = repo.save(ParcoursTemplate.builder()
                .name(req.getName().trim())
                .structureJson(req.getStructureJson())
                .sessionCount(req.getSessionCount())
                .build());
        return ResponseEntity.status(201).body(toDto(t));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private TemplateDto toDto(ParcoursTemplate t) {
        return TemplateDto.builder()
                .id(t.getId()).name(t.getName()).structureJson(t.getStructureJson())
                .sessionCount(t.getSessionCount()).createdAt(t.getCreatedAt())
                .build();
    }
}
