package com.medianet.auth.dto;

import lombok.*;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationMemberDto {
    private Long         id;
    private Long         userId;
    private String       fullName;
    private String       email;
    private String       phone;
    private String       avatarUrl;
    private String       headline;
    private String       linkedInUrl;
    private String       role;
    private String       responsibilities;
    private List<String> expertise;
    /** INTERNAL | EXTERNAL */
    private String       type;
}
