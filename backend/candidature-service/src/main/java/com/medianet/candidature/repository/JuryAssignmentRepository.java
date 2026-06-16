package com.medianet.candidature.repository;

import com.medianet.candidature.entity.JuryAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JuryAssignmentRepository extends JpaRepository<JuryAssignment, Long> {
    List<JuryAssignment> findByCandidatureId(Long candidatureId);
    List<JuryAssignment> findByJuryId(Long juryId);
    Optional<JuryAssignment> findByToken(String token);
    boolean existsByCandidatureIdAndJuryId(Long candidatureId, Long juryId);
    void deleteByCandidatureId(Long candidatureId);
}
