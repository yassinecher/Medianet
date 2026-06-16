package com.medianet.auth.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

/** Admin edit of another user's basic data. All fields optional (patch-style). */
@Data
public class AdminUpdateUserRequest {
    private String firstName;
    private String lastName;
    @Email
    private String email;
}
