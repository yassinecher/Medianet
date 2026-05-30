package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingFeature {
    @Column(name = "feature_title")
    private String title;

    @Column(name = "feature_description", columnDefinition = "TEXT")
    private String description;

    /** Lucide icon name — e.g. "Target", "Users", "Globe2", "Sparkles" */
    @Column(name = "feature_icon")
    private String icon;

    /** Optional uploaded photo for the feature (overrides the icon). */
    @Column(name = "feature_image_url", columnDefinition = "TEXT")
    private String imageUrl;
}
