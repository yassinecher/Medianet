package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JuryAssignmentDto {
    private Long id;
    private Long candidatureId;
    private Long juryId;
    private String juryEmail;
    private String juryName;
    private String token;
    private String status;
    private LocalDateTime assignedAt;
}
