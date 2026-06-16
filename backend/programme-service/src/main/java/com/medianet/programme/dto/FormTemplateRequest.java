package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FormTemplateRequest {
    @NotBlank
    private String name;
    /** JSON-encoded custom form schema. */
    private String schemaJson;
}
