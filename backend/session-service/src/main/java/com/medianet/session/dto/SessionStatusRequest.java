package com.medianet.session.dto;

import com.medianet.session.entity.SessionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SessionStatusRequest {
    @NotNull
    private SessionStatus status;
}
