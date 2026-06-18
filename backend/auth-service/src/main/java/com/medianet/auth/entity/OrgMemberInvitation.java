package com.medianet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Token invitation sent when a porteur adds a team member by email. The member
 * opens the tokenized link to create their own account, which is then linked to
 * the organisation (the {@link OrganizationMember} row gets its userId).
 */
@Entity
@Table(name = "org_member_invitations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OrgMemberInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 64)
    private String token;

    private Long organizationId;
    private String organizationName;
    private Long memberId;
    private String email;
    private String memberName;

    /** PENDING | ACCEPTED */
    @Builder.Default
    private String status = "PENDING";

    @CreationTimestamp
    private LocalDateTime createdAt;
}
