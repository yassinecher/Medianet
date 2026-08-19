package com.medianet.programme.repository;

import com.medianet.programme.entity.CoachingReview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CoachingReviewRepository extends JpaRepository<CoachingReview, Long> {
    List<CoachingReview> findByParticipantIdOrderByCreatedAtDescIdDesc(Long participantId);
}
