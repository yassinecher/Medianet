package com.medianet.programme.repository;

import com.medianet.programme.entity.ParcoursTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParcoursTemplateRepository extends JpaRepository<ParcoursTemplate, Long> {
    List<ParcoursTemplate> findAllByOrderByCreatedAtDesc();
}
