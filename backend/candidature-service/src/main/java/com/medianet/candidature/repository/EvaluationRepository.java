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

    /** Per-session lookup. A null phaseId is translated to IS NULL by Spring Data,
     *  matching the global/legacy (session-less) evaluation. */
    Optional<Evaluation> findByCandidatureIdAndJuryIdAndPhaseId(Long candidatureId, Long juryId, Long phaseId);
}
