package com.medianet.programme.service;

import com.medianet.programme.dto.*;
import com.medianet.programme.entity.*;
import com.medianet.programme.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository        taskRepository;
    private final ProgrammeRepository   programmeRepository;

    // ── Create ────────────────────────────────────────────────────────────────

    public TaskDto createTask(Long programmeId, CreateTaskRequest req,
                              Long assignedByUserId, String assignedByName) {
        Programme programme = programmeRepository.findById(programmeId)
                .orElseThrow(() -> new IllegalArgumentException("Programme not found: " + programmeId));

        Task task = Task.builder()
                .programmeId(programmeId)
                .programmeName(programme.getTitle())
                .phaseId(req.getPhaseId())
                .phaseName(req.getPhaseName())
                .assignedToUserId(req.getAssignedToUserId())
                .assignedToEmail(req.getAssignedToEmail())
                .assignedToName(req.getAssignedToName())
                .assignedByUserId(assignedByUserId)
                .assignedByName(assignedByName)
                .title(req.getTitle())
                .description(req.getDescription())
                .dueDate(req.getDueDate())
                .priority(parsePriority(req.getPriority()))
                .status(TaskStatus.PENDING)
                .build();

        return toDto(taskRepository.save(task));
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskDto> getTasksByProgramme(Long programmeId, String status, Long userId, boolean adminOrMentor) {
        if (!adminOrMentor && userId != null) {
            // Porteur: only sees their own tasks
            return taskRepository
                    .findByProgrammeIdAndAssignedToUserIdOrderByDueDateAsc(programmeId, userId)
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        if (status != null) {
            return taskRepository
                    .findByProgrammeIdAndStatusOrderByDueDateAsc(programmeId, parseStatus(status))
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        return taskRepository
                .findByProgrammeIdOrderByDueDateAscCreatedAtDesc(programmeId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TaskDto> getTasksByPhase(Long phaseId) {
        return taskRepository.findByPhaseIdOrderByDueDateAscCreatedAtDesc(phaseId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TaskDto getTaskById(Long programmeId, Long taskId, Long requestingUserId, boolean adminOrMentor) {
        Task task = findTask(programmeId, taskId);
        if (!adminOrMentor && !task.getAssignedToUserId().equals(requestingUserId)) {
            throw new IllegalArgumentException("Task not found or access denied");
        }
        return toDto(task);
    }

    /** Cross-programme "my tasks" for a porteur */
    @Transactional(readOnly = true)
    public List<TaskDto> getMyTasks(Long userId, String status) {
        if (status != null) {
            return taskRepository.findByAssignedToUserIdAndStatusOrderByDueDateAsc(userId, parseStatus(status))
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        return taskRepository.findByAssignedToUserIdOrderByDueDateAscCreatedAtDesc(userId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    /** Cross-programme list — ADMIN/MENTOR, optionally filtered. */
    @Transactional(readOnly = true)
    public List<TaskDto> getAllTasks(String status, Long programmeId) {
        List<Task> list;
        if (programmeId != null && status != null) {
            list = taskRepository.findByProgrammeIdAndStatusOrderByDueDateAsc(programmeId, parseStatus(status));
        } else if (programmeId != null) {
            list = taskRepository.findByProgrammeIdOrderByDueDateAscCreatedAtDesc(programmeId);
        } else if (status != null) {
            list = taskRepository.findByStatusOrderByDueDateAscCreatedAtDesc(parseStatus(status));
        } else {
            list = taskRepository.findAllByOrderByDueDateAscCreatedAtDesc();
        }
        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    // ── Update (admin / mentor) ───────────────────────────────────────────────

    public TaskDto updateTaskById(Long taskId, UpdateTaskRequest req) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        return updateTask(task.getProgrammeId(), taskId, req);
    }

    public TaskDto updateTaskStatusById(Long taskId, String newStatus, Long requestingUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        return updateTaskStatus(task.getProgrammeId(), taskId, newStatus, requestingUserId);
    }

    public void deleteTaskById(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        taskRepository.delete(task);
    }

    public TaskDto updateTask(Long programmeId, Long taskId, UpdateTaskRequest req) {
        Task task = findTask(programmeId, taskId);
        if (req.getTitle()           != null) task.setTitle(req.getTitle());
        if (req.getDescription()     != null) task.setDescription(req.getDescription());
        if (req.getDueDate()         != null) task.setDueDate(req.getDueDate());
        if (req.getPriority()        != null) task.setPriority(parsePriority(req.getPriority()));
        if (req.getPhaseId()         != null) task.setPhaseId(req.getPhaseId());
        if (req.getPhaseName()       != null) task.setPhaseName(req.getPhaseName());
        if (req.getAssignedToUserId()!= null) task.setAssignedToUserId(req.getAssignedToUserId());
        if (req.getAssignedToEmail() != null) task.setAssignedToEmail(req.getAssignedToEmail());
        if (req.getAssignedToName()  != null) task.setAssignedToName(req.getAssignedToName());
        if (req.getStatus()          != null) {
            TaskStatus newStatus = parseStatus(req.getStatus());
            task.setStatus(newStatus);
            if (newStatus == TaskStatus.COMPLETED && task.getCompletedAt() == null) {
                task.setCompletedAt(LocalDateTime.now());
            }
        }
        return toDto(taskRepository.save(task));
    }

    /** Porteur self-updates status of their own task */
    public TaskDto updateTaskStatus(Long programmeId, Long taskId,
                                    String newStatus, Long requestingUserId) {
        Task task = findTask(programmeId, taskId);
        if (!task.getAssignedToUserId().equals(requestingUserId)) {
            throw new IllegalArgumentException("You can only update your own tasks");
        }
        TaskStatus ts = parseStatus(newStatus);
        task.setStatus(ts);
        if (ts == TaskStatus.COMPLETED && task.getCompletedAt() == null) {
            task.setCompletedAt(LocalDateTime.now());
        }
        return toDto(taskRepository.save(task));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void deleteTask(Long programmeId, Long taskId) {
        Task task = findTask(programmeId, taskId);
        taskRepository.delete(task);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Long> getProgrammeTaskStats(Long programmeId) {
        return Map.of(
                "total",      taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.PENDING)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.IN_PROGRESS)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.COMPLETED)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.CANCELLED),
                "pending",    taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.PENDING),
                "inProgress", taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.IN_PROGRESS),
                "completed",  taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.COMPLETED),
                "cancelled",  taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.CANCELLED)
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getMyTaskStats(Long userId) {
        return Map.of(
                "pending",    taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.PENDING),
                "inProgress", taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.IN_PROGRESS),
                "completed",  taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.COMPLETED),
                "cancelled",  taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.CANCELLED)
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task findTask(Long programmeId, Long taskId) {
        return taskRepository.findById(taskId)
                .filter(t -> t.getProgrammeId() != null && t.getProgrammeId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Task " + taskId + " not found in programme " + programmeId));
    }

    private TaskDto toDto(Task t) {
        return TaskDto.builder()
                .id(t.getId())
                .programmeId(t.getProgrammeId())
                .programmeName(t.getProgrammeName())
                .phaseId(t.getPhaseId())
                .phaseName(t.getPhaseName())
                .assignedToUserId(t.getAssignedToUserId())
                .assignedToEmail(t.getAssignedToEmail())
                .assignedToName(t.getAssignedToName())
                .assignedByUserId(t.getAssignedByUserId())
                .assignedByName(t.getAssignedByName())
                .title(t.getTitle())
                .description(t.getDescription())
                .dueDate(t.getDueDate())
                .priority(t.getPriority().name())
                .status(t.getStatus().name())
                .completedAt(t.getCompletedAt())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private TaskStatus parseStatus(String s) {
        try { return TaskStatus.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid task status: " + s); }
    }

    private TaskPriority parsePriority(String p) {
        if (p == null) return TaskPriority.MEDIUM;
        try { return TaskPriority.valueOf(p.toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid task priority: " + p); }
    }
}
