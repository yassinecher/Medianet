package com.medianet.candidature.repository;

import com.medianet.candidature.entity.Candidature;
import com.medianet.candidature.entity.CandidatureStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidatureRepository extends JpaRepository<Candidature, Long> {

    // ── Porteur queries ───────────────────────────────────────────────────────
    List<Candidature> findByPorteurId(Long porteurId);

    // ── Status queries ────────────────────────────────────────────────────────
    List<Candidature> findByStatus(CandidatureStatus status);
    List<Candidature> findAllByOrderBySubmittedAtDesc();
    List<Candidature> findByStatusOrderBySubmittedAtDesc(CandidatureStatus status);

    // ── Programme-based queries ───────────────────────────────────────────────
    List<Candidature> findByProgrammeIdOrderBySubmittedAtDesc(Long programmeId);
    List<Candidature> findByProgrammeIdAndStatusOrderBySubmittedAtDesc(Long programmeId, CandidatureStatus status);
    Optional<Candidature> findByPorteurIdAndProgrammeId(Long porteurId, Long programmeId);
    List<Candidature> findByCompanyIdOrderBySubmittedAtDesc(Long companyId);
    List<Candidature> findByPhaseIdOrderBySubmittedAtDesc(Long phaseId);

    // ── Count helpers ─────────────────────────────────────────────────────────
    long countByStatus(CandidatureStatus status);
    long countByProgrammeId(Long programmeId);
    long countByProgrammeIdAndStatus(Long programmeId, CandidatureStatus status);
}
