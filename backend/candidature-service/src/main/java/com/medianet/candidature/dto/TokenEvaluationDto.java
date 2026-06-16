package com.medianet.candidature.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for the no-login token evaluation page: a light candidature summary +
 * the jury identity resolved from the token + any evaluation already submitted.
 * Criteria are fetched separately (public programme endpoint) by programmeId.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenEvaluationDto {
    private Long candidatureId;
    private String projectName;
    private String companyName;
    private String porteurName;
    private Long programmeId;
    /** Evaluating session id — the page scopes criteria to this session's selection. */
    private Long phaseId;
    private String candidatureStatus;
    private String juryName;
    private String juryEmail;
    private boolean submitted;
    /** Existing evaluation for this jury (by email), or null if not yet evaluated. */
    private EvaluationDto evaluation;
}
