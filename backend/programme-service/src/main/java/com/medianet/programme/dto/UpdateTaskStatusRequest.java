package com.medianet.programme.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateTaskStatusRequest {
    @NotBlank
    private String status;  // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
}
