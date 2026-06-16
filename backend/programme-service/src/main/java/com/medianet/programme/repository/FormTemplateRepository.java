package com.medianet.programme.repository;

import com.medianet.programme.entity.SavedFormTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FormTemplateRepository extends JpaRepository<SavedFormTemplate, Long> {
    List<SavedFormTemplate> findAllByOrderByCreatedAtDesc();
}
