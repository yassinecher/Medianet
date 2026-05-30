package com.medianet.programme.repository;

import com.medianet.programme.entity.Programme;
import com.medianet.programme.entity.ProgrammeStatus;
import com.medianet.programme.entity.ProgrammeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProgrammeRepository extends JpaRepository<Programme, Long> {

    List<Programme> findByStatus(ProgrammeStatus status);

    List<Programme> findByType(ProgrammeType type);

    List<Programme> findByTypeAndStatus(ProgrammeType type, ProgrammeStatus status);

    /** Public programmes that are open for applications. */
    List<Programme> findByTypeAndStatusIn(ProgrammeType type, List<ProgrammeStatus> statuses);

    long countByStatus(ProgrammeStatus status);
}
