package com.medianet.session.service;

import com.medianet.session.dto.*;
import com.medianet.session.entity.Session;
import com.medianet.session.entity.SessionStatus;
import com.medianet.session.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;

    public SessionDto createSession(CreateSessionRequest request, Long adminId, String adminName) {
        Session session = Session.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .submissionDeadline(request.getSubmissionDeadline())
                .maxProjects(request.getMaxProjects())
                .status(SessionStatus.OPEN)
                .createdByAdminId(adminId)
                .createdByAdminName(adminName)
                .build();
        return toDto(sessionRepository.save(session));
    }

    public List<SessionDto> getSessions(SessionStatus status) {
        if (status != null) {
            return sessionRepository.findByStatusOrderByCreatedAtDesc(status)
                    .stream().map(this::toDto).collect(Collectors.toList());
        }
        return sessionRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public SessionDto getSessionById(Long id) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        return toDto(session);
    }

    public SessionDto updateSession(Long id, UpdateSessionRequest request, Long adminId) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        if (request.getTitle() != null) session.setTitle(request.getTitle());
        if (request.getDescription() != null) session.setDescription(request.getDescription());
        if (request.getStartDate() != null) session.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) session.setEndDate(request.getEndDate());
        if (request.getSubmissionDeadline() != null) session.setSubmissionDeadline(request.getSubmissionDeadline());
        if (request.getMaxProjects() != null) session.setMaxProjects(request.getMaxProjects());
        return toDto(sessionRepository.save(session));
    }

    public SessionDto changeStatus(Long id, SessionStatus status) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus(status);
        return toDto(sessionRepository.save(session));
    }

    public Map<String, Long> getStats() {
        return Map.of(
                "total", sessionRepository.count(),
                "open", sessionRepository.countByStatus(SessionStatus.OPEN),
                "evaluation", sessionRepository.countByStatus(SessionStatus.EVALUATION),
                "closed", sessionRepository.countByStatus(SessionStatus.CLOSED),
                "cancelled", sessionRepository.countByStatus(SessionStatus.CANCELLED)
        );
    }

    private SessionDto toDto(Session s) {
        return SessionDto.builder()
                .id(s.getId())
                .title(s.getTitle())
                .description(s.getDescription())
                .startDate(s.getStartDate())
                .endDate(s.getEndDate())
                .submissionDeadline(s.getSubmissionDeadline())
                .status(s.getStatus().name())
                .maxProjects(s.getMaxProjects())
                .createdByAdminId(s.getCreatedByAdminId())
                .createdByAdminName(s.getCreatedByAdminName())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
