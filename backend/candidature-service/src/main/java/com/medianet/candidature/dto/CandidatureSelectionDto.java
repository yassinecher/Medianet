package com.medianet.candidature.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CandidatureSelectionDto {
    private Long id;
    private Long programmeId;
    private String name;
    private List<Long> candidatureIds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
