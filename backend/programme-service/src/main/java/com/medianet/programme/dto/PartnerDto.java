package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PartnerDto {
    private Long id;
    private String name;
    private String logoUrl;
    private LocalDateTime createdAt;
}
