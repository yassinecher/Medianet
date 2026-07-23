package com.medianet.auth.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationDto {
    private Long          id;
    private String        name;
    /** STARTUP | INCUBATOR | UNIVERSITY | ASSOCIATION | SPONSOR | CORPORATE | GOVERNMENT | OTHER */
    private String        type;
    private String        description;
    private String        sector;
    private String        city;
    private String        country;
    private String        address;
    private String        website;
    private String        contactEmail;
    private String        contactPhone;
    private Integer       foundedYear;
    private String        employeeCount;
    private String        logoUrl;
    private Boolean       internal;
    /** Shown on the public « Sociétés incubées » page (admin-set). */
    private Boolean       showcased;
    private Long          createdByUserId;
    private Long          linkedCompanyId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<OrganizationMemberDto> members;
}
