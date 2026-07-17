package com.medianet.auth.dto;

import lombok.*;

import java.util.Set;

/** Full role description for the back-office role manager. */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RoleDto {
    private Long id;
    private String name;
    private String displayName;
    private String description;
    /** Built-in role: cannot be renamed or deleted (ADMIN: permissions locked too). */
    private boolean systemRole;
    /** Permission slugs OWNED by this role (excluding inherited). */
    private Set<String> permissions;
    /** Name of the parent role this role inherits from (null = none). */
    private String parentName;
    /** Permission slugs inherited from the parent chain (not owned). */
    private Set<String> inheritedPermissions;
    /** How many users currently hold this role. */
    private long userCount;
}
