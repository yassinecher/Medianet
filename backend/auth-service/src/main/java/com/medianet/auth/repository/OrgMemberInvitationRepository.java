package com.medianet.auth.repository;

import com.medianet.auth.entity.OrgMemberInvitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrgMemberInvitationRepository extends JpaRepository<OrgMemberInvitation, Long> {
    Optional<OrgMemberInvitation> findByToken(String token);
    /** Cancel a member's invitation token when they're removed from the org. */
    void deleteByMemberId(Long memberId);
}
