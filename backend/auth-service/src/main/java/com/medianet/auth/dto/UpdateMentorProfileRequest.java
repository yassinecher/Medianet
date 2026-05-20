package com.medianet.auth.dto;

import lombok.*;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateMentorProfileRequest {
    private String title;
    private String bio;
    private List<String> expertise;
    private List<String> specializations;
    private String availability;
    private String linkedInUrl;
    private String website;
    private Integer yearsOfExperience;
}
