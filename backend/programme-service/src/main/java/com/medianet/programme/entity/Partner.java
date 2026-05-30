package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "partners")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Partner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** URL of the partner's logo (external URL or data URI). */
    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    @CreationTimestamp
    private LocalDateTime createdAt;

    /** Programmes this partner is associated with. */
    @ManyToMany(mappedBy = "partners")
    @Builder.Default
    private List<Programme> programmes = new ArrayList<>();
}
