package com.medianet.auth.dto;

import lombok.*;

import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateOrganizationMemberRequest {
    private Long         userId;
    private String       fullName;
    private String       email;
    private String       phone;
    private String       role;
    private String       responsibilities;
    private List<String> expertise;
    private String       type;
}
