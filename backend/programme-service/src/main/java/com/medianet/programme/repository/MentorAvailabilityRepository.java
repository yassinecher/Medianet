package com.medianet.programme.repository;

import com.medianet.programme.entity.MentorAvailability;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface MentorAvailabilityRepository extends JpaRepository<MentorAvailability, Long> {

    List<MentorAvailability> findByMentorUserIdOrderBySlotDateAscStartTimeAsc(Long mentorUserId);

    /** Open (unbooked) future slots of a mentor — what a porteur may book. */
    List<MentorAvailability> findByMentorUserIdAndBookedFalseAndSlotDateGreaterThanEqualOrderBySlotDateAscStartTimeAsc(
            Long mentorUserId, LocalDate from);
}
