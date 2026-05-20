package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Legacy single-role update – kept for backward compat */
@Data
public class UpdateRoleRequest {
    @NotBlank
    private String role;
}
