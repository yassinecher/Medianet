package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PitchSubmissionDto {
    private Long id;
    private Long programmeId;
    private Long sessionId;
    private String kind;
    private Long porteurId;
    private String porteurName;
    private String porteurEmail;
    private Long organizationId;
    private String companyName;
    private String projectName;
    private String title;
    private String videoUrl;
    private String videoFilename;
    private String transcript;
    private Boolean autoTranscribed;
    private String segmentsJson;
    private Integer durationSeconds;
    private String notes;
    private String status;
    private Double aiScore;
    private String aiAnalysisJson;
    private Boolean aiEnhanced;
    private Boolean archived;
    private LocalDateTime analyzedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
