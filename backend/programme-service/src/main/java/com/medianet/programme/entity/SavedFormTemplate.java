package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A reusable, named application-form template (a saved custom form schema) that
 * admins can save once and load into any programme. Distinct from the {@link FormTemplate}
 * enum (built-in preset kinds) — this stores a full custom schema by name.
 */
@Entity
@Table(name = "form_templates")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SavedFormTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** JSON-encoded custom form schema (same shape as Programme.customFormSchema). */
    @Column(name = "schema_json", columnDefinition = "TEXT")
    private String schemaJson;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
