package com.medianet.auth.repository;

import com.medianet.auth.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Set;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findBySlug(String slug);
    boolean existsBySlug(String slug);
    Set<Permission> findByCategory(String category);
}
