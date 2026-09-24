package com.medianet.programme.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Editor payload: the working copy + whether it differs from what is published. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LandingDraftDto {
    /** The draft if one exists, otherwise the published page. */
    private LandingPageDto page;
    /** True when there are unpublished changes. */
    private boolean hasDraft;
    private LocalDateTime draftUpdatedAt;
    private LocalDateTime publishedAt;
}
