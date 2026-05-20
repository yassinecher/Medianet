package com.medianet.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Set;

@Data
public class AssignRolesRequest {
    @NotNull
    private Set<String> roles;
}
