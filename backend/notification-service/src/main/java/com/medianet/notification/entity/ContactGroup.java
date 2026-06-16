package com.medianet.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A named mailing group / list — a curated set of {@link Contact} ids that can
 * be invited in one click.
 */
@Entity
@Table(name = "contact_groups")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ContactGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** Hex color for the group chip. */
    @Column(length = 16)
    private String color;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "contact_group_members", joinColumns = @JoinColumn(name = "group_id"))
    @Column(name = "contact_id")
    @Builder.Default
    private List<Long> contactIds = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;
}
