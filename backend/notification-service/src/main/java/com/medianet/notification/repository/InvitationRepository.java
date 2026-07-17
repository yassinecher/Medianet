package com.medianet.notification.repository;

import com.medianet.notification.entity.Invitation;
import com.medianet.notification.entity.InvitationStatus;
import com.medianet.notification.entity.InvitationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
    List<Invitation> findByActivityIdOrderByCreatedAtDesc(Long activityId);
    List<Invitation> findByRecipientEmailOrderByCreatedAtDesc(String recipientEmail);
    List<Invitation> findAllByOrderByCreatedAtDesc();

    /** Distinct session (phase) ids the given recipient has been invited to. */
    @Query("select distinct i.phaseId from Invitation i "
         + "where lower(i.recipientEmail) = lower(:email) and i.phaseId is not null")
    List<Long> findInvitedPhaseIds(@Param("email") String email);

    /** Distinct programme ids the given recipient has been invited to (any type,
     *  not declined). Powers « seulement les personnes invitées voient un
     *  programme privé ». */
    @Query("select distinct i.programmeId from Invitation i "
         + "where lower(i.recipientEmail) = lower(:email) and i.programmeId is not null "
         + "and i.status <> com.medianet.notification.entity.InvitationStatus.DECLINED")
    List<Long> findInvitedProgrammeIds(@Param("email") String email);

    long countByProgrammeIdAndStatus(Long programmeId, InvitationStatus status);
    long countByProgrammeIdAndType(Long programmeId, InvitationType type);
    long countByStatus(InvitationStatus status);
    long countByType(InvitationType type);
    boolean existsByProgrammeIdAndRecipientEmailAndType(Long programmeId, String email, InvitationType type);
}
