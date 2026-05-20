package com.medianet.session.repository;

import com.medianet.session.entity.Session;
import com.medianet.session.entity.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByStatus(SessionStatus status);
    List<Session> findByStatusOrderByCreatedAtDesc(SessionStatus status);
    List<Session> findAllByOrderByCreatedAtDesc();
    long countByStatus(SessionStatus status);
}
