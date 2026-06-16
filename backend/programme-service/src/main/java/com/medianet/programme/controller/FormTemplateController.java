package com.medianet.programme.controller;

import com.medianet.programme.dto.FormTemplateDto;
import com.medianet.programme.dto.FormTemplateRequest;
import com.medianet.programme.entity.SavedFormTemplate;
import com.medianet.programme.repository.FormTemplateRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/** Reusable named application-form templates (saved custom schemas). */
@RestController
@RequestMapping("/api/form-templates")
@RequiredArgsConstructor
public class FormTemplateController {

    private final FormTemplateRepository repo;

    @GetMapping
    public ResponseEntity<List<FormTemplateDto>> list() {
        return ResponseEntity.ok(
                repo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).collect(Collectors.toList()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<FormTemplateDto> create(@Valid @RequestBody FormTemplateRequest req) {
        SavedFormTemplate t = repo.save(SavedFormTemplate.builder()
                .name(req.getName().trim())
                .schemaJson(req.getSchemaJson())
                .build());
        return ResponseEntity.status(201).body(toDto(t));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private FormTemplateDto toDto(SavedFormTemplate t) {
        return FormTemplateDto.builder()
                .id(t.getId()).name(t.getName()).schemaJson(t.getSchemaJson()).createdAt(t.getCreatedAt())
                .build();
    }
}
