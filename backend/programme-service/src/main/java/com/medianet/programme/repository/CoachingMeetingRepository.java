package com.medianet.programme.repository;

import com.medianet.programme.entity.CoachingMeeting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CoachingMeetingRepository extends JpaRepository<CoachingMeeting, Long> {
    List<CoachingMeeting> findByParticipantIdOrderByProposedDateDescIdDesc(Long participantId);
    List<CoachingMeeting> findByParticipantIdInOrderByProposedDateAscIdAsc(Collection<Long> participantIds);
}
