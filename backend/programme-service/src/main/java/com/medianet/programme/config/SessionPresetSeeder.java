package com.medianet.programme.config;

import com.medianet.programme.entity.SessionPreset;
import com.medianet.programme.entity.SessionType;
import com.medianet.programme.repository.SessionPresetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds the 7 original session presets as global, built-in rows the first time
 * the app starts with an empty {@code session_presets} table. Idempotent: it
 * only inserts when no built-ins exist yet.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionPresetSeeder implements ApplicationRunner {

    private final SessionPresetRepository repo;

    private record Seed(SessionType type, String title, String color, String duration) {}

    private static final List<Seed> DEFAULTS = List.of(
        new Seed(SessionType.CANDIDATURE_SUBMISSION, "Candidature",  "#0EA5E9", "range"),
        new Seed(SessionType.PRESELECTION,           "Présélection", "#F59E0B", "range"),
        new Seed(SessionType.PITCH_DAY,              "Pitch Day",    "#EF4444", "day"),
        new Seed(SessionType.ONBOARDING,             "Onboarding",   "#10B981", "day"),
        new Seed(SessionType.INCUBATION,             "Incubation",   "#A855F7", "range"),
        new Seed(SessionType.DEMO_DAY,               "Demo Day",     "#F97316", "day"),
        new Seed(SessionType.TRAINING_DAY,           "Formation",    "#6366F1", "day")
    );

    @Override
    public void run(ApplicationArguments args) {
        if (repo.countByBuiltInTrue() > 0) return;   // already seeded
        int order = 0;
        for (Seed s : DEFAULTS) {
            repo.save(SessionPreset.builder()
                    .programmeId(null)        // global
                    .sessionType(s.type())
                    .title(s.title())
                    .color(s.color())
                    .durationKind(s.duration())
                    .builtIn(true)
                    .sortOrder(order++)
                    .build());
        }
        log.info("Seeded {} built-in session presets", DEFAULTS.size());
    }
}
