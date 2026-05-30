package com.medianet.programme.repository;

import com.medianet.programme.entity.Task;
import com.medianet.programme.entity.TaskStatus;
import com.medianet.programme.entity.TaskPriority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    // ── By programme ──────────────────────────────────────────────────────────
    List<Task> findByProgrammeIdOrderByDueDateAscCreatedAtDesc(Long programmeId);
    List<Task> findByProgrammeIdAndStatusOrderByDueDateAsc(Long programmeId, TaskStatus status);
    List<Task> findByProgrammeIdAndAssignedToUserIdOrderByDueDateAsc(Long programmeId, Long userId);

    // ── By phase ──────────────────────────────────────────────────────────────
    List<Task> findByPhaseIdOrderByDueDateAscCreatedAtDesc(Long phaseId);

    // ── Cross-programme listing (admin / mentor) ──────────────────────────────
    List<Task> findAllByOrderByDueDateAscCreatedAtDesc();
    List<Task> findByStatusOrderByDueDateAscCreatedAtDesc(TaskStatus status);

    // ── By assignee (cross-programme "my tasks") ──────────────────────────────
    List<Task> findByAssignedToUserIdOrderByDueDateAscCreatedAtDesc(Long userId);
    List<Task> findByAssignedToUserIdAndStatusOrderByDueDateAsc(Long userId, TaskStatus status);

    // ── By assigner ───────────────────────────────────────────────────────────
    List<Task> findByAssignedByUserIdOrderByCreatedAtDesc(Long userId);

    // ── Counts ────────────────────────────────────────────────────────────────
    long countByProgrammeIdAndStatus(Long programmeId, TaskStatus status);
    long countByAssignedToUserIdAndStatus(Long userId, TaskStatus status);
}
