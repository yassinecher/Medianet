package com.medianet.adminai.repository;

import com.medianet.adminai.entity.AiSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiSettingsRepository extends JpaRepository<AiSettings, Long> {
}
