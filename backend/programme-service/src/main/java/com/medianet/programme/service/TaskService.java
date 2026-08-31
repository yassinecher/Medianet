package com.medianet.programme.service;

import com.medianet.programme.dto.*;
import com.medianet.programme.dto.TaskActionRequests.AttachmentRequest;
import com.medianet.programme.dto.TaskActionRequests.CollaboratorRequest;
import com.medianet.programme.dto.TaskActionRequests.CommentRequest;
import com.medianet.programme.dto.TaskActionRequests.StepRequest;
import com.medianet.programme.dto.TaskActionRequests.StepUpdateRequest;
import com.medianet.programme.entity.*;
import com.medianet.programme.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
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
                .expectedDeliverable(req.getExpectedDeliverable())
                .dueDate(req.getDueDate())
                .priority(parsePriority(req.getPriority()))
                .status(TaskStatus.PENDING)
                .build();

        task.getActivityLog().add(logEntry(assignedByUserId, assignedByName, "CREATED",
                "Tâche créée" + (task.getAssignedToName() != null ? " · assignée à " + task.getAssignedToName() : "")));
        return toDto(taskRepository.save(task), true);
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
        task.setDeletedAt(LocalDateTime.now());   // soft-delete → moves to trash, restorable
        taskRepository.save(task);
    }

    public TaskDto updateTask(Long programmeId, Long taskId, UpdateTaskRequest req) {
        Task task = findTask(programmeId, taskId);
        if (req.getTitle()           != null) task.setTitle(req.getTitle());
        if (req.getDescription()     != null) task.setDescription(req.getDescription());
        if (req.getExpectedDeliverable() != null) task.setExpectedDeliverable(req.getExpectedDeliverable());
        if (req.getReviewNote()      != null) task.setReviewNote(req.getReviewNote());
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
        task.getActivityLog().add(logEntry(requestingUserId, actorNameFor(task, requestingUserId),
                ts == TaskStatus.IN_PROGRESS ? "STARTED" : "STATUS", "Statut : " + statusLabel(ts)));
        return toDto(taskRepository.save(task), true);
    }

    // ── Deliverable workflow: assignee submits → admin reviews ─────────────────

    /** The assignee submits their deliverable (rendu). Task → SUBMITTED. */
    public TaskDto submitTask(Long taskId, Long requestingUserId, SubmitTaskRequest req) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        if (task.getAssignedToUserId() != null && !task.getAssignedToUserId().equals(requestingUserId)) {
            throw new IllegalArgumentException("You can only submit your own tasks");
        }
        task.setSubmissionText(req.getSubmissionText());
        task.setSubmissionUrl(req.getSubmissionUrl());
        task.setSubmittedAt(LocalDateTime.now());
        task.setReviewNote(null);              // clear any previous "changes requested" note
        task.setStatus(TaskStatus.SUBMITTED);
        long files = task.getAttachments().stream().filter(a -> "SUBMISSION".equals(a.getKind())).count();
        task.getActivityLog().add(logEntry(requestingUserId, actorNameFor(task, requestingUserId), "SUBMITTED",
                "Livrable soumis" + (files > 0 ? " · " + files + " document(s)" : "")));
        return toDto(taskRepository.save(task), true);
    }

    /** Admin/mentor reviews a submission: approve → COMPLETED, else back to IN_PROGRESS. */
    public TaskDto reviewTask(Long taskId, ReviewTaskRequest req, Long reviewerId, String reviewerName) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        if (req.isApprove()) {
            task.setStatus(TaskStatus.COMPLETED);
            if (task.getCompletedAt() == null) task.setCompletedAt(LocalDateTime.now());
            task.setReviewNote(req.getReviewNote());
            task.getActivityLog().add(logEntry(reviewerId, reviewerName, "APPROVED",
                    "Livrable approuvé" + (isBlank(req.getReviewNote()) ? "" : " · " + req.getReviewNote())));
        } else {
            task.setStatus(TaskStatus.IN_PROGRESS);   // sent back for revision
            task.setReviewNote(req.getReviewNote());
            task.getActivityLog().add(logEntry(reviewerId, reviewerName, "REVISION_REQUESTED",
                    isBlank(req.getReviewNote()) ? "Révision demandée" : req.getReviewNote()));
        }
        return toDto(taskRepository.save(task), true);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void deleteTask(Long programmeId, Long taskId) {
        Task task = findTask(programmeId, taskId);
        task.setDeletedAt(LocalDateTime.now());   // soft-delete → moves to trash, restorable
        taskRepository.save(task);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Long> getProgrammeTaskStats(Long programmeId) {
        return Map.of(
                "total",      taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.PENDING)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.IN_PROGRESS)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.SUBMITTED)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.COMPLETED)
                            + taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.CANCELLED),
                "pending",    taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.PENDING),
                "inProgress", taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.IN_PROGRESS),
                "submitted",  taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.SUBMITTED),
                "completed",  taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.COMPLETED),
                "cancelled",  taskRepository.countByProgrammeIdAndStatus(programmeId, TaskStatus.CANCELLED)
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getMyTaskStats(Long userId) {
        return Map.of(
                "pending",    taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.PENDING),
                "inProgress", taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.IN_PROGRESS),
                "submitted",  taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.SUBMITTED),
                "completed",  taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.COMPLETED),
                "cancelled",  taskRepository.countByAssignedToUserIdAndStatus(userId, TaskStatus.CANCELLED)
        );
    }

    // ── Rich actions: detail, attachments, steps, collaborators, comments ──────

    @Transactional(readOnly = true)
    public TaskDto getTaskDetail(Long taskId, Long userId, boolean privileged) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        return toDto(task, true);
    }

    public TaskDto addAttachment(Long taskId, Long userId, String userName, boolean privileged, AttachmentRequest req) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        String kind = "RESOURCE".equalsIgnoreCase(req.getKind()) ? "RESOURCE" : "SUBMISSION";
        task.getAttachments().add(TaskAttachment.builder()
                .code(uuid()).kind(kind).url(req.getUrl()).name(req.getName())
                .sizeBytes(req.getSizeBytes()).contentType(req.getContentType())
                .uploadedByUserId(userId).uploadedByName(userName).createdAt(LocalDateTime.now()).build());
        task.getActivityLog().add(logEntry(userId, userName, "FILE_ADDED",
                ("RESOURCE".equals(kind) ? "Ressource ajoutée : " : "Document ajouté : ") + req.getName()));
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto removeAttachment(Long taskId, String code, Long userId, boolean privileged) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        task.getAttachments().removeIf(a -> Objects.equals(a.getCode(), code)
                && (privileged || Objects.equals(a.getUploadedByUserId(), userId)));
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto addStep(Long taskId, Long userId, String userName, boolean privileged, StepRequest req) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        if (isBlank(req.getTitle())) throw new IllegalArgumentException("Titre de l'étape requis");
        task.getSteps().add(TaskStep.builder().code(uuid()).title(req.getTitle().trim())
                .done(false).createdAt(LocalDateTime.now()).build());
        task.getActivityLog().add(logEntry(userId, userName, "STEP_ADDED", "Étape : " + req.getTitle().trim()));
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto updateStep(Long taskId, String code, Long userId, String userName, boolean privileged, StepUpdateRequest req) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        for (TaskStep s : task.getSteps()) {
            if (Objects.equals(s.getCode(), code)) {
                if (req.getTitle() != null && !req.getTitle().isBlank()) s.setTitle(req.getTitle().trim());
                if (req.getDone() != null) {
                    s.setDone(req.getDone());
                    s.setDoneByName(req.getDone() ? userName : null);
                    s.setDoneAt(req.getDone() ? LocalDateTime.now() : null);
                    task.getActivityLog().add(logEntry(userId, userName, req.getDone() ? "STEP_DONE" : "STEP_REOPENED",
                            (req.getDone() ? "Étape terminée : " : "Étape rouverte : ") + s.getTitle()));
                }
                break;
            }
        }
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto removeStep(Long taskId, String code, Long userId, boolean privileged) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        task.getSteps().removeIf(s -> Objects.equals(s.getCode(), code));
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto addCollaborator(Long taskId, CollaboratorRequest req) {
        Task task = load(taskId);
        if (req.getUserId() == null) throw new IllegalArgumentException("userId requis");
        boolean exists = task.getCollaborators().stream().anyMatch(c -> Objects.equals(c.getUserId(), req.getUserId()));
        if (!exists && !Objects.equals(req.getUserId(), task.getAssignedToUserId())) {
            task.getCollaborators().add(TaskCollaborator.builder()
                    .userId(req.getUserId()).name(req.getName()).role(req.getRole()).build());
            task.getActivityLog().add(logEntry(null, "Admin", "COLLABORATOR", "Acteur ajouté : " + req.getName()));
        }
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto removeCollaborator(Long taskId, Long userId) {
        Task task = load(taskId);
        task.getCollaborators().removeIf(c -> Objects.equals(c.getUserId(), userId));
        return toDto(taskRepository.save(task), true);
    }

    public TaskDto addComment(Long taskId, Long userId, String userName, boolean privileged, CommentRequest req) {
        Task task = load(taskId);
        assertCanAct(task, userId, privileged);
        if (isBlank(req.getNote())) throw new IllegalArgumentException("Commentaire vide");
        task.getActivityLog().add(logEntry(userId, userName, "COMMENT", req.getNote().trim()));
        return toDto(taskRepository.save(task), true);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task load(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
    }

    private void assertCanAct(Task task, Long userId, boolean privileged) {
        if (privileged) return;
        boolean ok = userId != null && (userId.equals(task.getAssignedToUserId())
                || task.getCollaborators().stream().anyMatch(c -> userId.equals(c.getUserId())));
        if (!ok) throw new IllegalArgumentException("Accès refusé à cette tâche");
    }

    private String actorNameFor(Task task, Long userId) {
        if (userId != null && userId.equals(task.getAssignedToUserId()) && task.getAssignedToName() != null)
            return task.getAssignedToName();
        return task.getCollaborators().stream().filter(c -> userId != null && userId.equals(c.getUserId()))
                .map(TaskCollaborator::getName).findFirst().orElse("Utilisateur");
    }

    private TaskLogEntry logEntry(Long userId, String name, String action, String note) {
        return TaskLogEntry.builder().actorUserId(userId).actorName(name == null ? "Utilisateur" : name)
                .action(action).note(note).at(LocalDateTime.now()).build();
    }

    private boolean isBlank(String s) { return s == null || s.isBlank(); }
    private String uuid() { return UUID.randomUUID().toString(); }
    private String statusLabel(TaskStatus s) {
        switch (s) {
            case PENDING: return "À faire";
            case IN_PROGRESS: return "En cours";
            case SUBMITTED: return "Soumise";
            case COMPLETED: return "Terminée";
            case CANCELLED: return "Annulée";
            default: return s.name();
        }
    }

    private Task findTask(Long programmeId, Long taskId) {
        return taskRepository.findById(taskId)
                .filter(t -> t.getProgrammeId() != null && t.getProgrammeId().equals(programmeId))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Task " + taskId + " not found in programme " + programmeId));
    }

    private TaskDto toDto(Task t) { return toDto(t, false); }

    private TaskDto toDto(Task t, boolean detail) {
        List<TaskDto.Attachment> atts = t.getAttachments() == null ? List.of()
                : t.getAttachments().stream().map(a -> TaskDto.Attachment.builder()
                    .code(a.getCode()).kind(a.getKind()).url(a.getUrl()).name(a.getName())
                    .sizeBytes(a.getSizeBytes()).contentType(a.getContentType())
                    .uploadedByUserId(a.getUploadedByUserId()).uploadedByName(a.getUploadedByName())
                    .createdAt(a.getCreatedAt()).build()).collect(Collectors.toList());
        List<TaskDto.Step> steps = t.getSteps() == null ? List.of()
                : t.getSteps().stream().map(s -> TaskDto.Step.builder()
                    .code(s.getCode()).title(s.getTitle()).done(s.isDone())
                    .doneByName(s.getDoneByName()).doneAt(s.getDoneAt()).build()).collect(Collectors.toList());
        List<TaskDto.Collaborator> collabs = t.getCollaborators() == null ? List.of()
                : t.getCollaborators().stream().map(c -> TaskDto.Collaborator.builder()
                    .userId(c.getUserId()).name(c.getName()).role(c.getRole()).build()).collect(Collectors.toList());
        List<TaskDto.LogEntry> logs = !detail || t.getActivityLog() == null ? null
                : t.getActivityLog().stream().map(l -> TaskDto.LogEntry.builder()
                    .actorUserId(l.getActorUserId()).actorName(l.getActorName())
                    .action(l.getAction()).note(l.getNote()).at(l.getAt()).build()).collect(Collectors.toList());

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
                .expectedDeliverable(t.getExpectedDeliverable())
                .dueDate(t.getDueDate())
                .priority(t.getPriority().name())
                .status(t.getStatus().name())
                .submissionText(t.getSubmissionText())
                .submissionUrl(t.getSubmissionUrl())
                .submittedAt(t.getSubmittedAt())
                .reviewNote(t.getReviewNote())
                .completedAt(t.getCompletedAt())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .attachments(atts)
                .steps(steps)
                .collaborators(collabs)
                .activityLog(logs)
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
