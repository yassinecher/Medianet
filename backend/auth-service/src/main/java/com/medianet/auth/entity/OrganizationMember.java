package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A person attached to an {@link Organization}.
 *
 * <p>If the member also has a platform account, {@link #userId} is set.
 * Otherwise the contact information lives directly on this row (good for
 * external speakers, advisors, sponsors).
 */
@Entity
@Table(name = "organization_members")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OrganizationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Optional — present if the member is a registered platform user. */
    private Long userId;

    @Column(nullable = false)
    private String fullName;

    private String email;
    private String phone;

    /** Their position inside the org ("CEO", "Mentor", "Speaker", …). */
    private String role;

    /** Free-form description of what they take care of in the programme. */
    @Column(columnDefinition = "TEXT")
    private String responsibilities;

    /** Expertise / skills tags (Java, Marketing, Finance, …). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "organization_member_expertise",
            joinColumns = @JoinColumn(name = "member_id"))
    @Column(name = "expertise")
    @Builder.Default
    private List<String> expertise = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "member_type", length = 16)
    @Builder.Default
    private MemberType type = MemberType.INTERNAL;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
