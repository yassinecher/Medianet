package com.medianet.adminai.repository;

import com.medianet.adminai.entity.ActionStatus;
import com.medianet.adminai.entity.AdminAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {
    List<AdminAction> findAllByOrderByCreatedAtDesc();
    List<AdminAction> findByStatusOrderByCreatedAtDesc(ActionStatus status);
    List<AdminAction> findByAdminIdOrderByCreatedAtDesc(Long adminId);
    List<AdminAction> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}
