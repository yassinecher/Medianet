package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Singleton (id = 1) holding the public landing page.
 *
 * <p>The page is an ordered list of typed BLOCKS (hero, stats, features, media,
 * process, programmes, testimonials, faq, cta) stored as JSON — any type may
 * appear several times. {@code blocksJson} is what visitors see;
 * {@code draftJson} is the admin's unpublished working copy (blocks + site
 * settings), promoted by "Publier".
 *
 * <p>Earlier versions stored every section in dedicated columns and five
 * element-collection tables (landing_stats, landing_features, …). Those columns
 * and tables are left untouched in existing databases; they are read once by
 * {@code LegacyLandingMigration} to build the first {@code blocksJson}.
 */
@Entity
@Table(name = "landing_page")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingPage {

    @Id
    @Builder.Default
    private Long id = 1L;

    /** Published blocks (JSON array of LandingBlock). Null = not migrated yet. */
    @Column(columnDefinition = "TEXT")
    private String blocksJson;

    /** Unpublished draft: full LandingPageDto JSON (blocks + settings). Null = no draft. */
    @Column(columnDefinition = "TEXT")
    private String draftJson;

    private LocalDateTime draftUpdatedAt;
    private LocalDateTime publishedAt;

    /** Bumped on every change of the published page — used as the public ETag. */
    private Long contentVersion;

    // ── Published site settings ──────────────────────────────────────────────
    /** Site logo override (null = bundled Medianet Incubator logo). */
    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    /** Landing-page colors (hex). Null = default Medianet palette. */
    private String primaryColor;
    private String accentColor;

    /**
     * Colors of the REST of the front office: "default" = Medianet palette,
     * "same" = reuse primaryColor/accentColor, "custom" = sitePrimaryColor/siteAccentColor.
     */
    private String siteThemeMode;
    private String sitePrimaryColor;
    private String siteAccentColor;

    @Column(columnDefinition = "TEXT")
    private String footerText;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
