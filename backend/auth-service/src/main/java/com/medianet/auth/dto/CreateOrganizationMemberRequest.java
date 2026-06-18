package com.medianet.auth.dto;

import lombok.*;

import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateOrganizationMemberRequest {
    private Long         userId;       // optional — if member already has an account
    /** Optional: in the invite-only flow the porteur supplies only an email; the
     *  name is derived/filled by the member after accepting. */
    private String       fullName;
    private String       email;
    private String       phone;
    private String       avatarUrl;
    private String       headline;
    private String       linkedInUrl;
    private String       role;
    private String       responsibilities;
    private List<String> expertise;
    private String       type;         // INTERNAL | EXTERNAL — default INTERNAL
}
