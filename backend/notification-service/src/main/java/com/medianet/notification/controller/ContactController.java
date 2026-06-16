package com.medianet.notification.controller;

import com.medianet.notification.dto.*;
import com.medianet.notification.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Managed contact list (contacts + groups) — ADMIN only. */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;

    // ── Contacts ────────────────────────────────────────────────────────────

    @GetMapping("/contacts")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<ContactDto>> listContacts() {
        return ResponseEntity.ok(contactService.listContacts());
    }

    @PostMapping("/contacts")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<ContactDto> createContact(@Valid @RequestBody ContactRequest req) {
        return ResponseEntity.status(201).body(contactService.createContact(req));
    }

    @PutMapping("/contacts/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<ContactDto> updateContact(@PathVariable Long id, @RequestBody ContactRequest req) {
        return ResponseEntity.ok(contactService.updateContact(id, req));
    }

    @DeleteMapping("/contacts/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<Void> deleteContact(@PathVariable Long id) {
        contactService.deleteContact(id);
        return ResponseEntity.noContent().build();
    }

    // ── Groups ──────────────────────────────────────────────────────────────

    @GetMapping("/contact-groups")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update') or hasAuthority('notifications:read')")
    public ResponseEntity<List<ContactGroupDto>> listGroups() {
        return ResponseEntity.ok(contactService.listGroups());
    }

    @PostMapping("/contact-groups")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<ContactGroupDto> createGroup(@Valid @RequestBody ContactGroupRequest req) {
        return ResponseEntity.status(201).body(contactService.createGroup(req));
    }

    @PutMapping("/contact-groups/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<ContactGroupDto> updateGroup(@PathVariable Long id, @RequestBody ContactGroupRequest req) {
        return ResponseEntity.ok(contactService.updateGroup(id, req));
    }

    @DeleteMapping("/contact-groups/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('notifications:update')")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        contactService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }
}
