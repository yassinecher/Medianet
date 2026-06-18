package com.medianet.auth.dto;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PorteurProfileDto {
    private Long id;
    private String company;
    private String sector;
    private String city;
    private String phoneNumber;
    private String website;
    private String linkedInUrl;
    private String avatarUrl;
    private String headline;
    private String twitterUrl;
    private String bio;
    private Integer candidatureCount;
}
