package com.medianet.programme.controller;

import com.medianet.programme.service.TrashService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * The trash — soft-deleted programmes, sessions, tasks and pitch submissions.
 *
 * <p>Nested under {@code /api/programmes} so it rides the existing gateway route
 * (no gateway change); the literal {@code /trash} segment is matched ahead of
 * {@code /api/programmes/{id}}. Admin / programme-manager only.
 */
@RestController
@RequestMapping("/api/programmes/trash")
@RequiredArgsConstructor
public class TrashController {

    private final TrashService trashService;

    /** Everything currently in the trash: {type, id, label, deletedAt}. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:read')")
    public ResponseEntity<List<Map<String, Object>>> list() {
        return ResponseEntity.ok(trashService.list());
    }

    /** Restore an item out of the trash. type ∈ programme|session|task|pitch. */
    @PostMapping("/{type}/{id}/restore")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> restore(@PathVariable String type, @PathVariable Long id) {
        trashService.restore(type, id);
        return ResponseEntity.noContent().build();
    }

    /** Permanently delete an item from the trash (irreversible). */
    @DeleteMapping("/{type}/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:delete')")
    public ResponseEntity<Void> purge(@PathVariable String type, @PathVariable Long id) {
        trashService.purge(type, id);
        return ResponseEntity.noContent().build();
    }
}
