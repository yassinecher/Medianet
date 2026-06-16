package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FormTemplateDto {
    private Long id;
    private String name;
    private String schemaJson;
    private LocalDateTime createdAt;
}
