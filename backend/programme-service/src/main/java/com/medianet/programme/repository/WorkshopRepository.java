package com.medianet.programme.repository;

import com.medianet.programme.entity.Workshop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface WorkshopRepository extends JpaRepository<Workshop, Long> {

    List<Workshop> findByProgrammeIdOrderByWorkshopDateAscIdAsc(Long programmeId);

    /** Workshops targeting any of the given participations (for the calendar). */
    @Query("select distinct w from Workshop w join w.targetParticipantIds t "
         + "where t in :participantIds order by w.workshopDate asc, w.id asc")
    List<Workshop> findByTargetParticipantIds(@Param("participantIds") Collection<Long> participantIds);
}
