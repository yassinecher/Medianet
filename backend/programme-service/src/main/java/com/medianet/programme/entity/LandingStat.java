package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingStat {
    @Column(name = "stat_label")
    private String label;

    @Column(name = "stat_value")
    private Integer value;

    /** Optional suffix shown next to the number — "+", "%", "K", "M" */
    @Column(name = "stat_suffix")
    private String suffix;
}
