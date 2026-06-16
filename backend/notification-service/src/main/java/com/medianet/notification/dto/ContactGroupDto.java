package com.medianet.notification.dto;

import lombok.*;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContactGroupDto {
    private Long id;
    private String name;
    private String color;
    private List<Long> contactIds;
}
