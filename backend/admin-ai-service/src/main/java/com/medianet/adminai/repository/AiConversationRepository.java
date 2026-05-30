package com.medianet.adminai.repository;

import com.medianet.adminai.entity.AiConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiConversationRepository extends JpaRepository<AiConversation, Long> {
    List<AiConversation> findByAdminIdOrderByUpdatedAtDesc(Long adminId);
}
