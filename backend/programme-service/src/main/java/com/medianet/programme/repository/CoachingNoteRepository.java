package com.medianet.programme.repository;

import com.medianet.programme.entity.CoachingNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoachingNoteRepository extends JpaRepository<CoachingNote, Long> {
    List<CoachingNote> findByParticipantIdOrderBySessionDateDescIdDesc(Long participantId);
}
