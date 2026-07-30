package com.medianet.auth.repository;

import com.medianet.auth.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    List<Organization> findByCreatedByUserId(Long userId);
    List<Organization> findByType(String type);
    List<Organization> findByInternalTrue();
    /** Organisations a given mentor is the assigned « vis-à-vis » of. */
    List<Organization> findByMentorUserId(Long mentorUserId);
    /** Organisations a given porteur explicitly represents (assigned, not creator). */
    List<Organization> findByPorteurUserId(Long porteurUserId);
}
