package com.medianet.programme.service;

import com.medianet.programme.dto.AvailabilityDto;
import com.medianet.programme.dto.AvailabilityRequest;
import com.medianet.programme.entity.CoachingMeeting;
import com.medianet.programme.entity.MentorAvailability;
import com.medianet.programme.entity.ProgrammeParticipant;
import com.medianet.programme.repository.CoachingMeetingRepository;
import com.medianet.programme.repository.MentorAvailabilityRepository;
import com.medianet.programme.repository.ProgrammeParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Mentor availability slots + booking. A mentor publishes windows when they are
 * free; a porteur they accompany books an open one, which creates an accepted
 * coaching meeting for that participation.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class AvailabilityService {

    private final MentorAvailabilityRepository repo;
    private final ProgrammeParticipantRepository participantRepository;
    private final CoachingMeetingRepository meetingRepository;

    // ── Mentor: manage own slots ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AvailabilityDto> listMine(Long mentorUserId) {
        return repo.findByMentorUserIdOrderBySlotDateAscStartTimeAsc(mentorUserId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public AvailabilityDto create(Long mentorUserId, AvailabilityRequest req) {
        if (req.getSlotDate() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date du créneau est requise.");
        MentorAvailability s = MentorAvailability.builder()
                .mentorUserId(mentorUserId)
                .slotDate(req.getSlotDate())
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .note(req.getNote())
                .booked(false)
                .build();
        return toDto(repo.save(s));
    }

    public void delete(Long id, Long callerId, boolean admin) {
        MentorAvailability s = find(id);
        if (!admin && !Objects.equals(s.getMentorUserId(), callerId))
            throw new AccessDeniedException("Vous ne pouvez supprimer que vos propres créneaux.");
        repo.delete(s);
    }

    // ── Porteur/mentor: view + book a participation's mentor slots ────────────

    @Transactional(readOnly = true)
    public List<AvailabilityDto> listForParticipation(Long participantId, Long callerId, boolean admin) {
        ProgrammeParticipant p = participation(participantId);
        assertParticipant(p, callerId, admin);
        if (p.getMentorUserId() == null) return List.of();
        return repo.findByMentorUserIdAndBookedFalseAndSlotDateGreaterThanEqualOrderBySlotDateAscStartTimeAsc(
                        p.getMentorUserId(), LocalDate.now())
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public AvailabilityDto book(Long slotId, Long callerId, String callerName, boolean admin, Long participantId) {
        MentorAvailability s = find(slotId);
        ProgrammeParticipant p = participation(participantId);
        assertParticipant(p, callerId, admin);
        if (s.isBooked())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce créneau vient d'être réservé.");
        if (!Objects.equals(s.getMentorUserId(), p.getMentorUserId()))
            throw new AccessDeniedException("Ce créneau n'appartient pas au mentor de cette startup.");

        s.setBooked(true);
        s.setBookedByParticipantId(participantId);
        repo.save(s);

        // Booking an already-published slot = a confirmed meeting.
        CoachingMeeting m = CoachingMeeting.builder()
                .participantId(participantId)
                .proposedDate(s.getSlotDate())
                .proposedTime(s.getStartTime())
                .location(s.getNote())
                .note("Réservé sur les disponibilités du mentor"
                        + (s.getEndTime() != null && !s.getEndTime().isBlank() ? " (jusqu'à " + s.getEndTime() + ")" : ""))
                .requestedByUserId(callerId)
                .requestedByName(callerName)
                .status("ACCEPTED")
                .build();
        meetingRepository.save(m);
        return toDto(s);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void assertParticipant(ProgrammeParticipant p, Long callerId, boolean admin) {
        if (admin) return;
        if (callerId != null && (callerId.equals(p.getMentorUserId()) || callerId.equals(p.getPorteurUserId()))) return;
        throw new AccessDeniedException("Réservé au porteur et au mentor de cette startup.");
    }

    private ProgrammeParticipant participation(Long participantId) {
        return participantRepository.findById(participantId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Participation introuvable."));
    }

    private MentorAvailability find(Long id) {
        return repo.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau introuvable."));
    }

    private AvailabilityDto toDto(MentorAvailability s) {
        return AvailabilityDto.builder()
                .id(s.getId()).mentorUserId(s.getMentorUserId())
                .slotDate(s.getSlotDate()).startTime(s.getStartTime()).endTime(s.getEndTime())
                .note(s.getNote()).booked(s.isBooked()).bookedByParticipantId(s.getBookedByParticipantId())
                .build();
    }
}
