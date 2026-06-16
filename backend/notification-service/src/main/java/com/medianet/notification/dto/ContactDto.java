package com.medianet.notification.dto;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContactDto {
    private Long id;
    private String name;
    private String email;
    private String organization;
    private String tag;
}
