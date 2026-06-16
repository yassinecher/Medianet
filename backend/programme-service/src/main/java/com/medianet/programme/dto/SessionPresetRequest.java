package com.medianet.programme.dto;

import lombok.*;

/**
 * Create/update payload for a {@link com.medianet.programme.entity.SessionPreset}.
 * On create: {@code programmeId} null → global, set → local. On update, only
 * non-null fields are applied (builtIn + programmeId are never reassigned).
 */
@Data @NoArgsConstructor @AllArgsConstructor
public class SessionPresetRequest {
    private Long    programmeId;
    private String  sessionType;
    private String  title;
    private String  color;
    private String  durationKind;   // "day" | "range"
    private Integer sortOrder;
}
