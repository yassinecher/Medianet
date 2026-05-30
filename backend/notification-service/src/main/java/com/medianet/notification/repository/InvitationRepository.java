package com.medianet.notification.repository;

import com.medianet.notification.entity.Invitation;
import com.medianet.notification.entity.InvitationStatus;
import com.medianet.notification.entity.InvitationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvitationRepository extends JpaRepository<Invitation, Long> {

    Optional<Invitation> findByToken(String token);

    List<Invitation> findByProgrammeIdOrderByCreatedAtDesc(Long programmeId);
    List<Invitation> findByProgrammeIdAndTypeOrderByCreatedAtDesc(Long programmeId, InvitationType type);
    List<Invitation> findByProgrammeIdAndStatusOrderByCreatedAtDesc(Long programmeId, InvitationStatus status);
    List<Invitation> findByPhaseIdOrderByCreatedAtDesc(Long phaseId);
    List<Invitation> findByRecipientEmailOrderByCreatedAtDesc(String recipientEmail);
    List<Invitation> findAllByOrderByCreatedAtDesc();

    long countByProgrammeIdAndStatus(Long programmeId, InvitationStatus status);
    long countByProgrammeIdAndType(Long programmeId, InvitationType type);
    long countByStatus(InvitationStatus status);
    long countByType(InvitationType type);
    boolean existsByProgrammeIdAndRecipientEmailAndType(Long programmeId, String email, InvitationType type);
}
