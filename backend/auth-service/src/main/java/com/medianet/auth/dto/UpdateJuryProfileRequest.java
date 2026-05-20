package com.medianet.auth.dto;

import lombok.*;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateJuryProfileRequest {
    private String title;
    private String bio;
    private String affiliation;
    private List<String> expertise;
    private String linkedInUrl;
}
