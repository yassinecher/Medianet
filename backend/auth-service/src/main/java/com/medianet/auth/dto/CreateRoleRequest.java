package com.medianet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.Set;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class CreateRoleRequest {

    /** Canonical name, stored upper-case (e.g. "COACH"). */
    @NotBlank(message = "Le nom du rôle est requis")
    @Size(max = 40, message = "Le nom du rôle ne peut dépasser 40 caractères")
    @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]*$",
             message = "Le nom du rôle ne peut contenir que des lettres, chiffres et _")
    private String name;

    @NotBlank(message = "Le libellé du rôle est requis")
    @Size(max = 80)
    private String displayName;

    @Size(max = 500)
    private String description;

    /** Initial permission slugs (optional). */
    private Set<String> permissions;

    /** Name of a role to inherit from (optional) — e.g. "MENTOR". */
    private String parentName;
}
