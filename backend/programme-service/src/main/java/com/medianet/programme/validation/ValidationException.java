package com.medianet.programme.validation;

import lombok.Getter;

/**
 * Domain validation failure carrying an explicit, stable error {@code code}
 * (e.g. SESSION_OVERLAP_DETECTED) so the frontend can react precisely.
 * Mapped to HTTP 400 with a {@code { code, message }} body.
 */
@Getter
public class ValidationException extends RuntimeException {

    /** Stable machine code — see {@link ValidationCode}. */
    private final String code;

    public ValidationException(ValidationCode code, String message) {
        super(message);
        this.code = code.name();
    }

    public enum ValidationCode {
        SESSION_DATE_INVALID,
        SESSION_OVERLAP_DETECTED,
        ACTIVITY_OUT_OF_SESSION_RANGE,
        PROGRAM_DATE_CONFLICT,
        ACTIVITY_NOT_ALLOWED
    }
}
