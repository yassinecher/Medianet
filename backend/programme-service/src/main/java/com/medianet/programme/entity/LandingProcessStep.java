package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingProcessStep {
    @Column(name = "step_title")
    private String title;

    @Column(name = "step_description", columnDefinition = "TEXT")
    private String description;

    /** Lucide icon name — e.g. "FileText", "ClipboardCheck", "Award" */
    @Column(name = "step_icon")
    private String icon;
}
