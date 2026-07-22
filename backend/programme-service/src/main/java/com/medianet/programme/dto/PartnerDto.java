package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PartnerDto {
    private Long id;
    private String name;
    private String logoUrl;
    private String description;
    private String website;
    private String contactEmail;
    private String contactPhone;
    private boolean publicVisible;
    private LocalDateTime createdAt;
}
