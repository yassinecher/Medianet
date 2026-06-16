package com.medianet.programme.repository;

import com.medianet.programme.entity.ProgrammePhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProgrammePhaseRepository extends JpaRepository<ProgrammePhase, Long> {

    List<ProgrammePhase> findByProgrammeIdOrderByPhaseOrderAsc(Long programmeId);

    /** Child day-sessions nested under a given range session. */
    List<ProgrammePhase> findByParentSessionId(Long parentSessionId);
}
