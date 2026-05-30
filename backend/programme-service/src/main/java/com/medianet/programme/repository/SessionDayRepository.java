package com.medianet.programme.repository;

import com.medianet.programme.entity.SessionDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionDayRepository extends JpaRepository<SessionDay, Long> {
    List<SessionDay> findBySession_IdOrderByDayOrderAsc(Long sessionId);
}
