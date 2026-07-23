package com.medianet.programme.repository;

import com.medianet.programme.entity.SessionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionAuditLogRepository extends JpaRepository<SessionAuditLog, Long> {
    List<SessionAuditLog> findTop100BySessionIdOrderByCreatedAtDesc(Long sessionId);
    List<SessionAuditLog> findTop200ByProgrammeIdOrderByCreatedAtDesc(Long programmeId);
}
