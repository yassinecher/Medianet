package com.medianet.programme.repository;

import com.medianet.programme.entity.CanvaToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CanvaTokenRepository extends JpaRepository<CanvaToken, Long> {
    Optional<CanvaToken> findByUserEmail(String userEmail);
}
