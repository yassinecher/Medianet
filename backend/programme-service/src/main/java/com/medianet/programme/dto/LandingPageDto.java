package com.medianet.programme.dto;

import com.medianet.programme.entity.LandingFaq;
import com.medianet.programme.entity.LandingFeature;
import com.medianet.programme.entity.LandingProcessStep;
import com.medianet.programme.entity.LandingStat;
import com.medianet.programme.entity.LandingTestimonial;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LandingPageDto {

    // Hero
    private String heroTitle;
    private String heroSubtitle;
    private String heroBadge;
    private String heroImageUrl;

    private String primaryCtaLabel;
    private String primaryCtaLink;
    private String secondaryCtaLabel;
    private String secondaryCtaLink;

    // Stats
    @Builder.Default
    private List<LandingStat>    stats    = new ArrayList<>();

    // Features
    @Builder.Default
    private List<LandingFeature> features = new ArrayList<>();

    // About
    private String aboutBadge;
    private String aboutTitle;
    private String aboutBody;
    private String aboutImageUrl;

    // Process
    private String processTitle;
    private String processSubtitle;
    @Builder.Default
    private List<LandingProcessStep> processSteps = new ArrayList<>();

    // Testimonials
    private String testimonialsTitle;
    @Builder.Default
    private List<LandingTestimonial> testimonials = new ArrayList<>();

    // FAQ
    private String faqTitle;
    @Builder.Default
    private List<LandingFaq> faqs = new ArrayList<>();

    // Open programmes carousel
    private String  programmesTitle;
    private String  programmesSubtitle;
    private Integer programmesLimit;

    // Final CTA + footer
    private String ctaTitle;
    private String ctaSubtitle;
    private String ctaButtonLabel;
    private String ctaButtonLink;
    private String footerText;

    // Theme
    private String primaryColor;
    private String accentColor;

    // Visibility flags
    private Boolean showHero;
    private Boolean showStats;
    private Boolean showAbout;
    private Boolean showFeatures;
    private Boolean showProcess;
    private Boolean showTestimonials;
    private Boolean showFaq;
    private Boolean showCta;
    private Boolean showProgrammes;

    /** CSV of section ids in render order. */
    private String sectionOrder;
}
