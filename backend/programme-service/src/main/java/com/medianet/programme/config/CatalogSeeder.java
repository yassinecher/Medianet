package com.medianet.programme.config;

import com.medianet.programme.entity.CatalogValue;
import com.medianet.programme.repository.CatalogValueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Seeds the editable reference lists from the values previously hard-coded in
 * the frontends, so existing forms keep their options out of the box. Idempotent:
 * only seeds a category when it's empty (admins own it afterwards).
 */
@Component
@RequiredArgsConstructor
public class CatalogSeeder implements CommandLineRunner {

    private final CatalogValueRepository repo;

    @Override
    public void run(String... args) {
        // Organisation types — value (enum-style) → label.
        seed("organization_type", new String[][] {
                { "STARTUP", "Startup" }, { "INCUBATOR", "Incubateur" }, { "UNIVERSITY", "Université" },
                { "ASSOCIATION", "Association" }, { "SPONSOR", "Sponsor" }, { "CORPORATE", "Corporate" },
                { "GOVERNMENT", "Public" }, { "OTHER", "Autre" },
        });
        // Programme sectors — free-text (value == label).
        seedFlat("programme_sector", new String[] {
                "Tech / Numérique", "Finance / Fintech", "Agriculture / Agritech",
                "Santé / Medtech", "Éducation", "Énergie / Cleantech",
                "Commerce / Retail", "Industrie", "Transport / Mobilité", "Tourisme", "Immobilier",
        });
    }

    private void seed(String category, String[][] pairs) {
        if (repo.countByCategory(category) > 0) return;
        int i = 0;
        for (String[] p : pairs) {
            repo.save(CatalogValue.builder().category(category).value(p[0]).label(p[1])
                    .sortOrder(i++).active(true).build());
        }
    }

    private void seedFlat(String category, String[] values) {
        if (repo.countByCategory(category) > 0) return;
        int i = 0;
        for (String v : values) {
            repo.save(CatalogValue.builder().category(category).value(v).label(v)
                    .sortOrder(i++).active(true).build());
        }
    }
}
