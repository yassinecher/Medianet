package com.medianet.auth.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdatePorteurProfileRequest {
    private String company;
    private String sector;
    private String city;
    private String phoneNumber;
    private String website;
    private String linkedInUrl;
    private String bio;
}
