package com.medianet.auth.repository;

import com.medianet.auth.entity.Organization;
import com.medianet.auth.entity.OrganizationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    List<Organization> findByCreatedByUserId(Long userId);
    List<Organization> findByType(OrganizationType type);
    List<Organization> findByInternalTrue();
}
