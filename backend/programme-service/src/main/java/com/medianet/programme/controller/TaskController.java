package com.medianet.programme.controller;

import com.medianet.programme.dto.*;
import com.medianet.programme.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    // ══════════════════════════════════════════════════════════════════════════
    // Programme-scoped task endpoints  →  /api/programmes/{programmeId}/tasks
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Create a task inside a programme.
     * Admin or Mentor can assign tasks to any porteur.
     */
    @PostMapping("/api/programmes/{programmeId}/tasks")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<TaskDto> createTask(
            @PathVariable Long programmeId,
            @Valid @RequestBody CreateTaskRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName) {
        String name = firstName != null ? firstName : "Admin";
        return ResponseEntity.status(201).body(taskService.createTask(programmeId, req, adminId, name));
    }

    /**
     * List tasks of a programme.
     * - ADMIN / MENTOR: sees all tasks (optionally filtered by ?status=)
     * - PORTEUR: sees only tasks assigned to them
     */
    @GetMapping("/api/programmes/{programmeId}/tasks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskDto>> getByProgramme(
            @PathVariable Long programmeId,
            @RequestParam(required = false) String status,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRole", required = false) String userRole) {
        boolean privileged = "ADMIN".equals(userRole) || "MENTOR".equals(userRole);
        return ResponseEntity.ok(taskService.getTasksByProgramme(programmeId, status, userId, privileged));
    }

    /**
     * Get a single task.
     * Admin/Mentor sees any task. Porteur can only see their own.
     */
    @GetMapping("/api/programmes/{programmeId}/tasks/{taskId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TaskDto> getTask(
            @PathVariable Long programmeId,
            @PathVariable Long taskId,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRole", required = false) String userRole) {
        boolean privileged = "ADMIN".equals(userRole) || "MENTOR".equals(userRole);
        return ResponseEntity.ok(taskService.getTaskById(programmeId, taskId, userId, privileged));
    }

    /**
     * Full update of a task (title, description, assignee, priority, status, due date).
     * Admin / Mentor only.
     */
    @PutMapping("/api/programmes/{programmeId}/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<TaskDto> updateTask(
            @PathVariable Long programmeId,
            @PathVariable Long taskId,
            @RequestBody UpdateTaskRequest req) {
        return ResponseEntity.ok(taskService.updateTask(programmeId, taskId, req));
    }

    /**
     * Porteur self-updates the status of their own task.
     * (Admin/Mentor can use PUT above instead.)
     */
    @PatchMapping("/api/programmes/{programmeId}/tasks/{taskId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TaskDto> updateStatus(
            @PathVariable Long programmeId,
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskStatusRequest req,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRole", required = false) String userRole) {
        // Admin/Mentor bypass the ownership check via the full update endpoint,
        // but we allow them here too for convenience
        boolean privileged = "ADMIN".equals(userRole) || "MENTOR".equals(userRole);
        if (privileged) {
            UpdateTaskRequest full = new UpdateTaskRequest();
            full.setStatus(req.getStatus());
            return ResponseEntity.ok(taskService.updateTask(programmeId, taskId, full));
        }
        return ResponseEntity.ok(taskService.updateTaskStatus(programmeId, taskId, req.getStatus(), userId));
    }

    /**
     * Delete a task — ADMIN only.
     */
    @DeleteMapping("/api/programmes/{programmeId}/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update')")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long programmeId,
            @PathVariable Long taskId) {
        taskService.deleteTask(programmeId, taskId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Task stats for a programme — ADMIN / MENTOR.
     */
    @GetMapping("/api/programmes/{programmeId}/tasks/stats")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<Map<String, Long>> programmeStats(@PathVariable Long programmeId) {
        return ResponseEntity.ok(taskService.getProgrammeTaskStats(programmeId));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Cross-programme endpoints  →  /api/tasks
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Convenience: create a task by posting the programmeId in the body.
     * Equivalent to POST /api/programmes/{programmeId}/tasks.
     */
    @PostMapping("/api/tasks")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<TaskDto> createTaskFlat(
            @Valid @RequestBody CreateTaskRequest req,
            @RequestAttribute("userId") Long adminId,
            @RequestAttribute(value = "userFirstName", required = false) String firstName) {
        if (req.getProgrammeId() == null) {
            throw new IllegalArgumentException("programmeId is required when posting to /api/tasks");
        }
        String name = firstName != null ? firstName : "Admin";
        return ResponseEntity.status(201)
                .body(taskService.createTask(req.getProgrammeId(), req, adminId, name));
    }

    /** Convenience: list all tasks (ADMIN/MENTOR), optionally filtered by ?status= or ?programmeId= */
    @GetMapping("/api/tasks")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<List<TaskDto>> getAllTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long programmeId) {
        return ResponseEntity.ok(taskService.getAllTasks(status, programmeId));
    }

    /** Convenience: update a task by its global id (admin/mentor only). */
    @PutMapping("/api/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<TaskDto> updateTaskFlat(
            @PathVariable Long taskId,
            @RequestBody UpdateTaskRequest req) {
        return ResponseEntity.ok(taskService.updateTaskById(taskId, req));
    }

    /** Convenience: delete a task by its global id (admin only). */
    @DeleteMapping("/api/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update')")
    public ResponseEntity<Void> deleteTaskFlat(@PathVariable Long taskId) {
        taskService.deleteTaskById(taskId);
        return ResponseEntity.noContent().build();
    }

    /** Convenience: porteur updates the status of their own task by global id. */
    @PatchMapping("/api/tasks/{taskId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TaskDto> updateStatusFlat(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskStatusRequest req,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute(value = "userRole", required = false) String userRole) {
        boolean privileged = "ADMIN".equals(userRole) || "MENTOR".equals(userRole);
        if (privileged) {
            UpdateTaskRequest full = new UpdateTaskRequest();
            full.setStatus(req.getStatus());
            return ResponseEntity.ok(taskService.updateTaskById(taskId, full));
        }
        return ResponseEntity.ok(taskService.updateTaskStatusById(taskId, req.getStatus(), userId));
    }

    /**
     * The assignee submits their deliverable (rendu) → task moves to SUBMITTED,
     * awaiting admin/mentor review. Only the assignee (or a privileged user) may submit.
     */
    @PatchMapping("/api/tasks/{taskId}/submit")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TaskDto> submitTask(
            @PathVariable Long taskId,
            @RequestBody SubmitTaskRequest req,
            @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(taskService.submitTask(taskId, userId, req));
    }

    /**
     * Admin/mentor reviews a submitted deliverable: approve → COMPLETED,
     * or request changes → back to IN_PROGRESS with a note.
     */
    @PatchMapping("/api/tasks/{taskId}/review")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<TaskDto> reviewTask(
            @PathVariable Long taskId,
            @RequestBody ReviewTaskRequest req) {
        return ResponseEntity.ok(taskService.reviewTask(taskId, req));
    }

    /**
     * "My tasks" — porteur/team-member sees all tasks assigned to them
     * across every programme, optionally filtered by ?status=
     */
    @GetMapping("/api/tasks/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskDto>> myTasks(
            @RequestParam(required = false) String status,
            @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(taskService.getMyTasks(userId, status));
    }

    /**
     * Personal task stats (pending / in_progress / completed).
     */
    @GetMapping("/api/tasks/my/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Long>> myStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(taskService.getMyTaskStats(userId));
    }

    /**
     * Tasks for a specific phase — ADMIN / MENTOR.
     */
    @GetMapping("/api/tasks/phase/{phaseId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('tasks:update') or hasRole('MENTOR')")
    public ResponseEntity<List<TaskDto>> byPhase(@PathVariable Long phaseId) {
        return ResponseEntity.ok(taskService.getTasksByPhase(phaseId));
    }
}
