package com.medianet.programme.repository;

import com.medianet.programme.entity.LandingPage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LandingPageRepository extends JpaRepository<LandingPage, Long> {
}
