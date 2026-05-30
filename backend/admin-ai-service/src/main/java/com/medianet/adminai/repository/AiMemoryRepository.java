package com.medianet.adminai.repository;

import com.medianet.adminai.entity.AiMemory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiMemoryRepository extends JpaRepository<AiMemory, Long> {
    Optional<AiMemory> findByFactKey(String factKey);
    List<AiMemory> findAllByOrderByCategoryAscFactKeyAsc();
    void deleteByFactKey(String factKey);
}
