package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProgrammeParticipantDto {
    private Long id;
    private Long programmeId;
    private Long organizationId;
    private String organizationName;
    private Long porteurUserId;
    private String porteurName;
    private String porteurEmail;
    private Long mentorUserId;
    private String status;
    private LocalDateTime joinedAt;
}
