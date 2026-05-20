package com.medianet.auth.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AdminProfileDto {
    private Long id;
    private String department;
    private String phoneNumber;
    private String adminLevel;
    private LocalDateTime lastLoginAt;
}
