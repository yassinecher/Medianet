package com.medianet.programme.repository;

import com.medianet.programme.entity.CoachingPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoachingPlanRepository extends JpaRepository<CoachingPlan, Long> {
    Optional<CoachingPlan> findByParticipantId(Long participantId);
}
