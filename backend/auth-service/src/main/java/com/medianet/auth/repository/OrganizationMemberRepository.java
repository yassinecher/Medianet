package com.medianet.auth.repository;

import com.medianet.auth.entity.OrganizationMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, Long> {
    List<OrganizationMember> findByOrganization_Id(Long organizationId);
}
