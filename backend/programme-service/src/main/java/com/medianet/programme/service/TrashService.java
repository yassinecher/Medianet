package com.medianet.programme.service;

import com.medianet.programme.entity.Programme;
import com.medianet.programme.entity.ProgrammePhase;
import com.medianet.programme.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * The trash: soft-deleted rows across this service (programmes, sessions, tasks,
 * pitch submissions). Every such entity carries {@code @SQLRestriction("deleted_at
 * is null")}, so trashed rows are invisible to normal queries — this service uses
 * native SQL (which the restriction does not touch) to list, restore and purge.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TrashService {

    private final TrashRepository            trashRepository;
    private final ProgrammeRepository        programmeRepository;
    private final ProgrammePhaseRepository   phaseRepository;
    private final SessionAuditTrail          auditTrail;

    private static final Set<String> TYPES = Set.of("programme", "session", "task", "pitch");

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : trashRepository.findAllTrashed()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", r[0] == null ? null : r[0].toString());
            m.put("id", r[1] == null ? null : ((Number) r[1]).longValue());
            m.put("label", r[2] == null ? null : r[2].toString());
            m.put("deletedAt", r[3] == null ? null : r[3].toString());
            out.add(m);
        }
        return out;
    }

    /** Bring an item back out of the trash. */
    public void restore(String type, Long id) {
        validate(type);
        switch (type) {
            case "programme" -> trashRepository.restoreProgramme(id);
            case "session"   -> {
                trashRepository.restoreSession(id);
                // Now visible again → look it up for the audit line.
                phaseRepository.findById(id).ifPresent(ph ->
                        auditTrail.record(ph, "RESTORED", "Session restaurée depuis la corbeille"));
            }
            case "task"      -> trashRepository.restoreTask(id);
            case "pitch"     -> trashRepository.restorePitch(id);
        }
    }

    /** Permanently remove an item (irreversible). */
    public void purge(String type, Long id) {
        validate(type);
        switch (type) {
            case "task"      -> trashRepository.purgeTask(id);
            case "pitch"     -> trashRepository.purgePitch(id);
            case "session"   -> purgeSession(id);
            case "programme" -> purgeProgramme(id);
        }
    }

    private void purgeSession(Long id) {
        // Nested day-sessions first (trashed or not), then the range session itself.
        for (ProgrammePhase child : phaseRepository.findByParentSessionIdIncludingTrashed(id)) {
            phaseRepository.delete(child);
        }
        phaseRepository.findByIdIncludingTrashed(id).ifPresent(ph -> {
            auditTrail.record(ph, "PURGED", "Session supprimée définitivement");
            phaseRepository.delete(ph);
        });
    }

    private void purgeProgramme(Long id) {
        // Un-hide any individually-trashed sessions so the JPA cascade removes them
        // too — otherwise they'd keep a dangling FK to the deleted programme.
        trashRepository.unhideProgrammePhases(id);
        programmeRepository.findByIdIncludingTrashed(id).ifPresent(p -> {
            if (p.getPartners() != null) p.getPartners().clear();
            programmeRepository.delete(p);   // cascade: phases + criteria (orphanRemoval)
        });
    }

    private void validate(String type) {
        if (type == null || !TYPES.contains(type))
            throw new IllegalArgumentException("Type de corbeille inconnu : " + type);
    }
}
