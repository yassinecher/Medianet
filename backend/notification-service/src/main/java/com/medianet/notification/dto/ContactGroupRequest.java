package com.medianet.notification.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ContactGroupRequest {
    @NotBlank
    private String name;
    private String color;
    private List<Long> contactIds;
}
