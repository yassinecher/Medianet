package com.medianet.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Live auth events pushed to logged-in clients over SSE.
 *
 * <p>Each user can hold several streams (multiple tabs / both frontends). When an
 * admin changes a user's roles, direct permissions or active flag — or edits the
 * permission set of a role the user holds — every open stream of that user gets a
 * {@code permissions-changed} event. The client then calls {@code POST
 * /api/auth/refresh} to obtain a fresh JWT (claims re-read from the DB) and
 * re-renders its layout.
 */
@Service
@Slf4j
public class AuthEventService {

    /** userId → open SSE streams for that user. */
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        // No servlet timeout — the scheduled heartbeat keeps intermediaries from
        // closing the connection; the client reconnects if it drops anyway.
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> remove(userId, emitter));
        emitter.onError(e -> remove(userId, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected")
                    .data(Map.of("userId", userId, "at", Instant.now().toString())));
        } catch (IOException e) {
            remove(userId, emitter);
        }
        return emitter;
    }

    /** The user's effective permissions/roles changed — client should refresh its token. */
    public void permissionsChanged(Long userId) {
        sendAfterCommit(List.of(userId), "permissions-changed");
    }

    /** Same event for a whole set of users (e.g. everyone holding an edited role). */
    public void permissionsChanged(Collection<Long> userIds) {
        sendAfterCommit(List.copyOf(userIds), "permissions-changed");
    }

    /** The account was disabled — client should log the user out. */
    public void accountDisabled(Long userId) {
        sendAfterCommit(List.of(userId), "account-disabled");
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Events describe committed state: if a transaction is active, delay the send
     * until after commit so a client that immediately re-fetches sees new data
     * (and nothing is announced for a rolled-back change).
     */
    private void sendAfterCommit(List<Long> userIds, String event) {
        Runnable task = () -> userIds.forEach(id -> send(id, event));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { task.run(); }
            });
        } else {
            task.run();
        }
    }

    private void send(Long userId, String event) {
        List<SseEmitter> list = emitters.get(userId);
        if (list == null || list.isEmpty()) return;
        Map<String, Object> payload = Map.of("userId", userId, "at", Instant.now().toString());
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(event).data(payload));
            } catch (Exception e) {
                remove(userId, emitter);
            }
        }
        log.debug("Auth event '{}' sent to user {} ({} stream(s))", event, userId, list.size());
    }

    private void remove(Long userId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(userId);
        if (list == null) return;
        list.remove(emitter);
        if (list.isEmpty()) emitters.remove(userId, list);
    }

    /** Keep-alive ping so proxies/gateways don't drop idle streams. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        emitters.forEach((userId, list) -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    remove(userId, emitter);
                }
            }
        });
    }
}
