package com.medianet.programme.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * A free-form landing-page section created by an admin. Stored as JSON on the
 * landing page (see {@code LandingPage.customSectionsJson}) and placed in the
 * render order as {@code custom:<id>} inside {@code sectionOrder}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LandingCustomSection {

    /** Stable client-generated id (referenced from sectionOrder as "custom:<id>"). */
    private String id;

    /**
     * Layout: "text-image" (text beside a photo), "gallery" (photo grid) or
     * "carousel" (sliding photos).
     */
    @Builder.Default
    private String layout = "text-image";

    private String badge;
    private String title;
    private String subtitle;
    private String body;

    /** For "text-image": which side the photo sits on ("left" | "right"). */
    @Builder.Default
    private String imagePosition = "right";

    /** "default" | "muted" | "dark" band background. */
    @Builder.Default
    private String background = "default";

    private String ctaLabel;
    private String ctaLink;

    @Builder.Default
    private Boolean visible = true;

    @Builder.Default
    private List<Image> images = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Image {
        private String url;
        private String caption;
    }
}
