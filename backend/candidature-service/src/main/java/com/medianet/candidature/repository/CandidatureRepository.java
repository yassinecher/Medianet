package com.medianet.candidature.repository;

import com.medianet.candidature.entity.Candidature;
import com.medianet.candidature.entity.CandidatureStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidatureRepository extends JpaRepository<Candidature, Long> {
    List<Candidature> findByPorteurId(Long porteurId);
    List<Candidature> findBySessionId(Long sessionId);
    List<Candidature> findByStatus(CandidatureStatus status);
    List<Candidature> findBySessionIdAndStatus(Long sessionId, CandidatureStatus status);
    Optional<Candidature> findByPorteurIdAndSessionId(Long porteurId, Long sessionId);
    long countByStatus(CandidatureStatus status);
    List<Candidature> findAllByOrderBySubmittedAtDesc();
    List<Candidature> findByStatusOrderBySubmittedAtDesc(CandidatureStatus status);
    List<Candidature> findBySessionIdOrderBySubmittedAtDesc(Long sessionId);
    List<Candidature> findBySessionIdAndStatusOrderBySubmittedAtDesc(Long sessionId, CandidatureStatus status);
}
