package com.medianet.notification.service;

import com.medianet.notification.dto.*;
import com.medianet.notification.entity.Contact;
import com.medianet.notification.entity.ContactGroup;
import com.medianet.notification.repository.ContactGroupRepository;
import com.medianet.notification.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** CRUD for the managed contact list (contacts + groups). */
@Service
@RequiredArgsConstructor
@Transactional
public class ContactService {

    private final ContactRepository contactRepo;
    private final ContactGroupRepository groupRepo;

    // ── Contacts ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ContactDto> listContacts() {
        return contactRepo.findAllByOrderByNameAsc().stream().map(this::toDto).collect(Collectors.toList());
    }

    public ContactDto createContact(ContactRequest req) {
        Contact c = Contact.builder()
                .name(req.getName().trim())
                .email(req.getEmail().trim().toLowerCase())
                .organization(req.getOrganization())
                .tag(req.getTag())
                .build();
        return toDto(contactRepo.save(c));
    }

    public ContactDto updateContact(Long id, ContactRequest req) {
        Contact c = contactRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contact introuvable : " + id));
        if (req.getName() != null)  c.setName(req.getName().trim());
        if (req.getEmail() != null) c.setEmail(req.getEmail().trim().toLowerCase());
        c.setOrganization(req.getOrganization());
        c.setTag(req.getTag());
        return toDto(contactRepo.save(c));
    }

    public void deleteContact(Long id) {
        contactRepo.deleteById(id);
        // Drop the id from any group membership.
        for (ContactGroup g : groupRepo.findAll()) {
            if (g.getContactIds() != null && g.getContactIds().remove(id)) groupRepo.save(g);
        }
    }

    // ── Groups ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ContactGroupDto> listGroups() {
        return groupRepo.findAllByOrderByNameAsc().stream().map(this::toDto).collect(Collectors.toList());
    }

    public ContactGroupDto createGroup(ContactGroupRequest req) {
        ContactGroup g = ContactGroup.builder()
                .name(req.getName().trim())
                .color(req.getColor())
                .contactIds(req.getContactIds() != null ? new ArrayList<>(req.getContactIds()) : new ArrayList<>())
                .build();
        return toDto(groupRepo.save(g));
    }

    public ContactGroupDto updateGroup(Long id, ContactGroupRequest req) {
        ContactGroup g = groupRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Groupe introuvable : " + id));
        if (req.getName() != null)  g.setName(req.getName().trim());
        if (req.getColor() != null) g.setColor(req.getColor());
        if (req.getContactIds() != null) g.setContactIds(new ArrayList<>(req.getContactIds()));
        return toDto(groupRepo.save(g));
    }

    public void deleteGroup(Long id) {
        groupRepo.deleteById(id);
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private ContactDto toDto(Contact c) {
        return ContactDto.builder()
                .id(c.getId()).name(c.getName()).email(c.getEmail())
                .organization(c.getOrganization()).tag(c.getTag())
                .build();
    }

    private ContactGroupDto toDto(ContactGroup g) {
        return ContactGroupDto.builder()
                .id(g.getId()).name(g.getName()).color(g.getColor())
                .contactIds(g.getContactIds() != null ? new ArrayList<>(g.getContactIds()) : new ArrayList<>())
                .build();
    }
}
