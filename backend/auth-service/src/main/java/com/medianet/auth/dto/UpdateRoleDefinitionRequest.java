package com.medianet.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.Set;

/** Partial update of a role definition — null fields are left untouched. */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class UpdateRoleDefinitionRequest {

    /** Rename (custom roles only). */
    @Size(max = 40)
    @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]*$",
             message = "Le nom du rôle ne peut contenir que des lettres, chiffres et _")
    private String name;

    @Size(max = 80)
    private String displayName;

    @Size(max = 500)
    private String description;

    /** Full replacement of the role's permission slugs (null = unchanged). */
    private Set<String> permissions;

    /** Parent role name: null = unchanged, empty string = remove inheritance. */
    private String parentName;
}
