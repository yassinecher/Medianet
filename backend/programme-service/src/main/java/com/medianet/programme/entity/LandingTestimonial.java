package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingTestimonial {
    @Column(name = "testimonial_quote", columnDefinition = "TEXT")
    private String quote;

    @Column(name = "testimonial_author_name")
    private String authorName;

    @Column(name = "testimonial_author_role")
    private String authorRole;

    /** Optional headshot / company logo for the quote card. */
    @Column(name = "testimonial_photo_url", columnDefinition = "TEXT")
    private String photoUrl;
}
