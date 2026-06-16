package com.medianet.candidature.repository;

import com.medianet.candidature.entity.CandidatureSelection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CandidatureSelectionRepository extends JpaRepository<CandidatureSelection, Long> {
    List<CandidatureSelection> findByProgrammeIdOrderByCreatedAtDesc(Long programmeId);
}
