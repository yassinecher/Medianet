package com.medianet.auth.repository;

import com.medianet.auth.entity.PorteurProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PorteurProfileRepository extends JpaRepository<PorteurProfile, Long> {
    Optional<PorteurProfile> findByUserId(Long userId);
}
