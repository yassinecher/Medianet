package com.medianet.notification.service;

import com.medianet.notification.dto.*;
import com.medianet.notification.entity.*;
import com.medianet.notification.repository.InvitationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private InvitationRepository invitationRepository;
    @Mock private EmailService         emailService;

    @InjectMocks
    private NotificationService service;

    private Invitation baseInvitation;

    @BeforeEach
    void setUp() {
        baseInvitation = Invitation.builder()
                .id(1L)
                .type(InvitationType.JURY)
                .recipientEmail("jury@test.com")
                .recipientName("Judge Dredd")
                .programmeId(5L)
                .programmeName("Startup Challenge")
                .subject("Invitation jury")
                .message("Vous êtes invité en tant que jury")
                .requiresRsvp(true)
                .status(InvitationStatus.SENT)
                .sentByAdminId(1L)
                .sentByAdminName("Admin")
                .build();
    }

    // ── createAndSend ─────────────────────────────────────────────────────────

    @Test
    void createAndSend_withRsvp_savesAndSendsRsvpEmail() {
        CreateInvitationRequest req = new CreateInvitationRequest();
        req.setType("JURY");
        req.setRecipientEmail("jury@test.com");
        req.setRecipientName("Judge Dredd");
        req.setProgrammeId(5L);
        req.setProgrammeName("Startup Challenge");
        req.setSubject("Invitation jury");
        req.setMessage("Vous êtes invité");
        req.setRequiresRsvp(true);

        when(invitationRepository.save(any())).thenAnswer(inv -> {
            Invitation i = inv.getArgument(0);
            if (i.getId() == null) i.setId(1L);
            return i;
        });
        doNothing().when(emailService).sendRsvpEmail(any(Invitation.class));

        InvitationDto dto = service.createAndSend(req, 1L, "Admin");

        assertThat(dto.getRecipientEmail()).isEqualTo("jury@test.com");
        assertThat(dto.getType()).isEqualTo("JURY");
        verify(invitationRepository, atLeast(1)).save(any(Invitation.class));
        verify(emailService).sendRsvpEmail(any(Invitation.class));
    }

    @Test
    void createAndSend_emailNormalisedToLowerCase() {
        CreateInvitationRequest req = new CreateInvitationRequest();
        req.setType("MENTOR");
        req.setRecipientEmail("MENTOR@TEST.COM");
        req.setSubject("Test");
        req.setMessage("Message");
        req.setRequiresRsvp(false);

        when(invitationRepository.save(any())).thenAnswer(inv -> {
            Invitation i = inv.getArgument(0);
            i.setId(2L);
            return i;
        });
        doNothing().when(emailService).sendInvitationEmail(any(Invitation.class));

        InvitationDto dto = service.createAndSend(req, 1L, "Admin");
        assertThat(dto.getRecipientEmail()).isEqualTo("mentor@test.com");
    }

    // ── bulkInvite ────────────────────────────────────────────────────────────

    @Test
    void bulkInvite_multipleRecipients_savesOnePerRecipient() {
        BulkInviteRequest req = new BulkInviteRequest();
        req.setType("JURY");
        req.setProgrammeId(5L);
        req.setSubject("Invitation");
        req.setMessage("Message");
        req.setRequiresRsvp(false);

        BulkInviteRequest.RecipientItem r1 = new BulkInviteRequest.RecipientItem();
        r1.setEmail("a@test.com"); r1.setName("Alice");
        BulkInviteRequest.RecipientItem r2 = new BulkInviteRequest.RecipientItem();
        r2.setEmail("b@test.com"); r2.setName("Bob");
        req.setRecipients(List.of(r1, r2));

        final long[] idSeq = {1};
        when(invitationRepository.save(any())).thenAnswer(inv -> {
            Invitation i = inv.getArgument(0);
            if (i.getId() == null) i.setId(idSeq[0]++);
            return i;
        });
        doNothing().when(emailService).sendInvitationEmail(any(Invitation.class));

        List<InvitationDto> results = service.bulkInvite(req, 1L, "Admin");

        assertThat(results).hasSize(2);
        assertThat(results.stream().map(InvitationDto::getRecipientEmail))
                .containsExactlyInAnyOrder("a@test.com", "b@test.com");
        verify(emailService, times(2)).sendInvitationEmail(any(Invitation.class));
    }

    @Test
    void bulkInvite_emptyList_returnsEmptyResults() {
        BulkInviteRequest req = new BulkInviteRequest();
        req.setType("JURY");
        req.setRecipients(List.of());

        List<InvitationDto> results = service.bulkInvite(req, 1L, "Admin");

        assertThat(results).isEmpty();
        verify(invitationRepository, never()).save(any());
        verify(emailService, never()).sendInvitationEmail(any());
    }

    // ── sendEmail ─────────────────────────────────────────────────────────────

    @Test
    void sendEmail_toSingleAddress_callsRaw() {
        SendEmailRequest req = new SendEmailRequest();
        req.setToEmail("user@test.com");
        req.setToName("User");
        req.setSubject("Hello");
        req.setBody("World");
        req.setHtml(false);

        doNothing().when(emailService).sendRaw(anyString(), anyString(), anyString(), anyString(), anyBoolean());

        service.sendEmail(req);
        verify(emailService).sendRaw("user@test.com", "User", "Hello", "World", false);
    }

    @Test
    void sendEmail_toBroadcastList_callsBroadcast() {
        SendEmailRequest req = new SendEmailRequest();
        req.setToEmails(List.of("a@t.com", "b@t.com"));
        req.setSubject("Broadcast");
        req.setBody("Content");
        req.setHtml(true);

        doNothing().when(emailService).sendBroadcast(anyList(), anyString(), anyString(), anyBoolean());

        service.sendEmail(req);
        verify(emailService).sendBroadcast(List.of("a@t.com", "b@t.com"), "Broadcast", "Content", true);
    }

    @Test
    void sendEmail_noRecipient_throwsIllegalArgument() {
        SendEmailRequest req = new SendEmailRequest();
        req.setSubject("Test");
        req.setBody("Body");
        // toEmail and toEmails both null

        assertThatThrownBy(() -> service.sendEmail(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── acceptInvitation ──────────────────────────────────────────────────────

    @Test
    void accept_validToken_setsStatusAccepted() {
        baseInvitation.setStatus(InvitationStatus.PENDING);
        String token = baseInvitation.getToken();

        when(invitationRepository.findByToken(token)).thenReturn(Optional.of(baseInvitation));
        when(invitationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        InvitationDto dto = service.acceptInvitation(token);
        assertThat(dto.getStatus()).isEqualTo("ACCEPTED");
    }

    @Test
    void accept_invalidToken_throwsRuntimeException() {
        when(invitationRepository.findByToken("bad-token")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.acceptInvitation("bad-token"))
                .isInstanceOf(RuntimeException.class);
    }

    // ── declineInvitation ─────────────────────────────────────────────────────

    @Test
    void decline_validToken_setsStatusDeclined() {
        baseInvitation.setStatus(InvitationStatus.PENDING);
        String token = baseInvitation.getToken();

        when(invitationRepository.findByToken(token)).thenReturn(Optional.of(baseInvitation));
        when(invitationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        InvitationDto dto = service.declineInvitation(token);
        assertThat(dto.getStatus()).isEqualTo("DECLINED");
    }

    @Test
    void decline_invalidToken_throwsRuntimeException() {
        when(invitationRepository.findByToken("invalid")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.declineInvitation("invalid"))
                .isInstanceOf(RuntimeException.class);
    }

    // ── getById ───────────────────────────────────────────────────────────────

    @Test
    void getById_existingId_returnsDto() {
        when(invitationRepository.findById(1L)).thenReturn(Optional.of(baseInvitation));

        InvitationDto dto = service.getById(1L);
        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getRecipientEmail()).isEqualTo("jury@test.com");
        assertThat(dto.getStatus()).isEqualTo("SENT");
    }

    @Test
    void getById_missingId_throwsRuntimeException() {
        when(invitationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(99L))
                .isInstanceOf(RuntimeException.class);
    }

    // ── getAll ────────────────────────────────────────────────────────────────

    @Test
    void getAll_returnsAllInvitations() {
        when(invitationRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(baseInvitation));

        List<InvitationDto> list = service.getAll();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getRecipientEmail()).isEqualTo("jury@test.com");
    }

    @Test
    void getAll_empty_returnsEmptyList() {
        when(invitationRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());

        List<InvitationDto> list = service.getAll();
        assertThat(list).isEmpty();
    }

    // ── getByProgramme ────────────────────────────────────────────────────────

    @Test
    void getByProgramme_noFilters_returnsAll() {
        when(invitationRepository.findByProgrammeIdOrderByCreatedAtDesc(5L))
                .thenReturn(List.of(baseInvitation));

        List<InvitationDto> list = service.getByProgramme(5L, null, null);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getProgrammeId()).isEqualTo(5L);
    }

    @Test
    void getByProgramme_withTypeFilter_delegatesToRepository() {
        when(invitationRepository.findByProgrammeIdAndTypeOrderByCreatedAtDesc(5L, InvitationType.JURY))
                .thenReturn(List.of(baseInvitation));

        List<InvitationDto> list = service.getByProgramme(5L, "JURY", null);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getType()).isEqualTo("JURY");
        verify(invitationRepository).findByProgrammeIdAndTypeOrderByCreatedAtDesc(5L, InvitationType.JURY);
    }

    @Test
    void getByProgramme_withStatusFilter_delegatesToRepository() {
        when(invitationRepository.findByProgrammeIdAndStatusOrderByCreatedAtDesc(5L, InvitationStatus.SENT))
                .thenReturn(List.of(baseInvitation));

        List<InvitationDto> list = service.getByProgramme(5L, null, "SENT");
        assertThat(list).hasSize(1);
        verify(invitationRepository).findByProgrammeIdAndStatusOrderByCreatedAtDesc(5L, InvitationStatus.SENT);
    }
}
