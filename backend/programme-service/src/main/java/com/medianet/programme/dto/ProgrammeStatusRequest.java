package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class ProgrammeStatusRequest {
    @NotBlank
    private String status;
}
