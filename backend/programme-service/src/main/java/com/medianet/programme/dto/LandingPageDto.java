package com.medianet.programme.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** The landing-page document: ordered blocks + site-wide settings. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LandingPageDto {

    @Builder.Default
    private List<LandingBlock> blocks = new ArrayList<>();

    // ── Site settings ────────────────────────────────────────────────────────
    private String logoUrl;
    private String primaryColor;
    private String accentColor;
    /** "default" | "same" | "custom" — colors of the other front-office pages. */
    private String siteThemeMode;
    private String sitePrimaryColor;
    private String siteAccentColor;
    private String footerText;

    // ── Read-only metadata ───────────────────────────────────────────────────
    private Long version;
    private LocalDateTime publishedAt;
}
