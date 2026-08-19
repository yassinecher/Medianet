package com.medianet.programme.dto;

import lombok.*;

/** One targeted startup of a workshop — carries its mentor (auto-included). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkshopTargetDto {
    private Long participantId;
    private Long organizationId;
    private String organizationName;
    private Long mentorUserId;
    private String mentorName;
    private Long porteurUserId;
    private String porteurName;
}
