package com.medianet.auth.repository;

import com.medianet.auth.entity.CoachingNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoachingNoteRepository extends JpaRepository<CoachingNote, Long> {
    List<CoachingNote> findByOrganizationIdOrderBySessionDateDescIdDesc(Long organizationId);
}
