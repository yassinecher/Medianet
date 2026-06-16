package com.medianet.programme.dto;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SessionPresetDto {
    private Long    id;
    /** Null = global, set = local to a programme. */
    private Long    programmeId;
    private String  sessionType;
    private String  title;
    private String  color;
    /** "day" | "range". */
    private String  durationKind;
    private Boolean builtIn;
    private Integer sortOrder;
}
