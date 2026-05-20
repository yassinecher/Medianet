package com.medianet.auth.repository;

import com.medianet.auth.entity.JuryProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface JuryProfileRepository extends JpaRepository<JuryProfile, Long> {
    Optional<JuryProfile> findByUserId(Long userId);
}
