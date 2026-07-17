package com.medianet.programme.dto;

import lombok.*;

/** Porteur create/update payload for a pitch submission. */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class PitchSubmissionRequest {
    private Long   programmeId;
    private Long   sessionId;
    /** TRAINING (practice) or FINAL (real pitch). Defaults to FINAL. */
    private String kind;
    /** When updating an existing submission (e.g. a specific training video). */
    private Long   id;
    private Long   organizationId;
    private String companyName;
    private String projectName;
    private String title;
    private String videoUrl;
    private String videoFilename;
    private String transcript;
    private String notes;
    /** DRAFT | SUBMITTED (ANALYZED is set by the analysis write-back). */
    private String status;
}
