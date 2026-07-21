package com.medianet.programme.repository;

import com.medianet.programme.entity.ProgrammePhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProgrammePhaseRepository extends JpaRepository<ProgrammePhase, Long> {

    List<ProgrammePhase> findByProgrammeIdOrderByPhaseOrderAsc(Long programmeId);

    /** Child day-sessions nested under a given range session. */
    List<ProgrammePhase> findByParentSessionId(Long parentSessionId);

    /** Load a session even if trashed (native → bypasses @SQLRestriction). */
    @Query(value = "SELECT * FROM programme_phases WHERE id = :id", nativeQuery = true)
    Optional<ProgrammePhase> findByIdIncludingTrashed(Long id);

    /** Nested day-sessions of a range, trashed or not (for cascade purge). */
    @Query(value = "SELECT * FROM programme_phases WHERE parent_session_id = :id", nativeQuery = true)
    List<ProgrammePhase> findByParentSessionIdIncludingTrashed(Long id);
}
