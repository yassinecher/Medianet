package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Singleton — there is exactly one row (id=1) used for the public landing
 * page rendered at "/". An admin edits this from the backoffice.
 */
@Entity
@Table(name = "landing_page")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingPage {

    @Id
    @Builder.Default
    private Long id = 1L; // singleton

    // ── Hero ──────────────────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String heroTitle = "Incubez vos idées avec l'intelligence artificielle";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String heroSubtitle = "Medianet Incubateur connecte les porteurs de projets aux meilleures opportunités d'accompagnement à travers une plateforme intelligente.";

    @Column(columnDefinition = "TEXT")
    private String heroBadge; // e.g. "Plateforme d'incubation propulsée par l'IA"

    @Column(columnDefinition = "TEXT")
    private String heroImageUrl; // background or hero image (optional)

    @Builder.Default
    private String primaryCtaLabel = "Déposer ma candidature";

    @Builder.Default
    private String primaryCtaLink  = "/register";

    @Builder.Default
    private String secondaryCtaLabel = "Explorer les programmes";

    @Builder.Default
    private String secondaryCtaLink  = "/programmes";

    // ── Stats (animated counters in the second band) ──────────────────────────
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "landing_stats", joinColumns = @JoinColumn(name = "landing_id"))
    @OrderColumn(name = "stat_order")
    @Builder.Default
    private List<LandingStat> stats = new ArrayList<>();

    // ── Features ──────────────────────────────────────────────────────────────
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "landing_features", joinColumns = @JoinColumn(name = "landing_id"))
    @OrderColumn(name = "feature_order")
    @Builder.Default
    private List<LandingFeature> features = new ArrayList<>();

    // ── About section ─────────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String aboutBadge;

    @Column(columnDefinition = "TEXT")
    private String aboutTitle;

    @Column(columnDefinition = "TEXT")
    private String aboutBody;

    @Column(columnDefinition = "TEXT")
    private String aboutImageUrl;

    // ── Process / Timeline ────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String processTitle;

    @Column(columnDefinition = "TEXT")
    private String processSubtitle;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "landing_process_steps", joinColumns = @JoinColumn(name = "landing_id"))
    @OrderColumn(name = "step_order")
    @Builder.Default
    private List<LandingProcessStep> processSteps = new ArrayList<>();

    // ── Testimonials ──────────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String testimonialsTitle;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "landing_testimonials", joinColumns = @JoinColumn(name = "landing_id"))
    @OrderColumn(name = "testimonial_order")
    @Builder.Default
    private List<LandingTestimonial> testimonials = new ArrayList<>();

    // ── FAQ ───────────────────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String faqTitle;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "landing_faqs", joinColumns = @JoinColumn(name = "landing_id"))
    @OrderColumn(name = "faq_order")
    @Builder.Default
    private List<LandingFaq> faqs = new ArrayList<>();

    // ── Open programmes carousel ──────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String programmesTitle;

    @Column(columnDefinition = "TEXT")
    private String programmesSubtitle;

    /** How many open programmes to fetch and display (default 6). */
    @Builder.Default
    private Integer programmesLimit = 6;

    // ── Final CTA band ────────────────────────────────────────────────────────
    @Builder.Default
    private String ctaTitle = "Prêt à lancer votre projet ?";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String ctaSubtitle = "Rejoignez des centaines de startups accompagnées par Medianet";

    @Builder.Default
    private String ctaButtonLabel = "Commencer maintenant";

    @Builder.Default
    private String ctaButtonLink  = "/register";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String footerText = "© 2026 Medianet Incubateur. Tous droits réservés.";

    // ── Theme ─────────────────────────────────────────────────────────────────
    /** Primary brand color as hex (e.g. "#FF6A00"). Optional override. */
    private String primaryColor;
    /** Optional accent color for gradients. */
    private String accentColor;

    // ── Section visibility flags (all default true) ───────────────────────────
    @Builder.Default private Boolean showHero         = true;
    @Builder.Default private Boolean showStats        = true;
    @Builder.Default private Boolean showAbout        = false;
    @Builder.Default private Boolean showFeatures     = true;
    @Builder.Default private Boolean showProcess      = false;
    @Builder.Default private Boolean showTestimonials = false;
    @Builder.Default private Boolean showFaq          = false;
    @Builder.Default private Boolean showCta          = true;
    @Builder.Default private Boolean showProgrammes   = true;

    /**
     * Ordered comma-separated list of section ids the public page renders.
     * Default: hero, stats, features, cta (the original layout). Admins can drop
     * sections in/out and reorder them.
     */
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String sectionOrder = "hero,stats,features,about,process,programmes,testimonials,faq,cta";

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
