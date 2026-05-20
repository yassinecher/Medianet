package com.medianet.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Set;

@Data
public class GrantPermissionRequest {
    /** One or more permission names to grant or revoke */
    @NotNull
    private Set<String> permissions;
}
