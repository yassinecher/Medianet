package com.medianet.candidature.repository;

import com.medianet.candidature.entity.JuryAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JuryAssignmentRepository extends JpaRepository<JuryAssignment, Long> {
    List<JuryAssignment> findByCandidatureId(Long candidatureId);
    List<JuryAssignment> findByJuryId(Long juryId);
    boolean existsByCandidatureIdAndJuryId(Long candidatureId, Long juryId);
    void deleteByCandidatureId(Long candidatureId);
}
