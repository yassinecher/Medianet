package com.medianet.programme.repository;

import com.medianet.programme.entity.PitchKind;
import com.medianet.programme.entity.PitchSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PitchSubmissionRepository extends JpaRepository<PitchSubmission, Long> {
    List<PitchSubmission> findByPorteurIdOrderByUpdatedAtDesc(Long porteurId);
    List<PitchSubmission> findByProgrammeIdOrderByUpdatedAtDesc(Long programmeId);
    List<PitchSubmission> findBySessionIdOrderByUpdatedAtDesc(Long sessionId);
    /** The FINAL submission of a porteur for a session (single — upsert key). */
    Optional<PitchSubmission> findByPorteurIdAndSessionIdAndKind(Long porteurId, Long sessionId, PitchKind kind);
    /** All of a porteur's submissions for a session (training runs + final). */
    List<PitchSubmission> findByPorteurIdAndSessionIdOrderByCreatedAtAsc(Long porteurId, Long sessionId);
}
