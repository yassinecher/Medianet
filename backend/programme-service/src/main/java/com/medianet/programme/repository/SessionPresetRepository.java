package com.medianet.programme.repository;

import com.medianet.programme.entity.SessionPreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionPresetRepository extends JpaRepository<SessionPreset, Long> {

    /** Global presets + the ones local to the given programme, ordered for display. */
    @Query("""
           SELECT p FROM SessionPreset p
           WHERE p.programmeId IS NULL OR p.programmeId = :programmeId
           ORDER BY p.programmeId ASC NULLS FIRST, p.sortOrder ASC, p.id ASC
           """)
    List<SessionPreset> findVisibleFor(@Param("programmeId") Long programmeId);

    /** Only the global presets (programmeId null), ordered. */
    List<SessionPreset> findByProgrammeIdIsNullOrderBySortOrderAscIdAsc();

    long countByBuiltInTrue();
}
