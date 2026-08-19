package com.medianet.programme.repository;

import com.medianet.programme.entity.ProgrammeParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgrammeParticipantRepository extends JpaRepository<ProgrammeParticipant, Long> {
    List<ProgrammeParticipant> findByProgrammeId(Long programmeId);
    Optional<ProgrammeParticipant> findByProgrammeIdAndOrganizationId(Long programmeId, Long organizationId);
    List<ProgrammeParticipant> findByMentorUserId(Long mentorUserId);
    List<ProgrammeParticipant> findByPorteurUserId(Long porteurUserId);
    List<ProgrammeParticipant> findByOrganizationId(Long organizationId);
}
