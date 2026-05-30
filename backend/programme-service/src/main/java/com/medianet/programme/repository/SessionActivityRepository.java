package com.medianet.programme.repository;

import com.medianet.programme.entity.SessionActivity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionActivityRepository extends JpaRepository<SessionActivity, Long> {
    List<SessionActivity> findByDay_IdOrderByActivityOrderAsc(Long dayId);
}
