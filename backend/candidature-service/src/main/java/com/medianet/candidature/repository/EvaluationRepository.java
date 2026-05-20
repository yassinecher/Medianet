package com.medianet.candidature.repository;

import com.medianet.candidature.entity.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {
    List<Evaluation> findByCandidatureId(Long candidatureId);
    Optional<Evaluation> findByCandidatureIdAndJuryId(Long candidatureId, Long juryId);
    boolean existsByCandidatureIdAndJuryId(Long candidatureId, Long juryId);
}
