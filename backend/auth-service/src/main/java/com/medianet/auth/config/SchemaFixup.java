package com.medianet.auth.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-off non-destructive schema corrections that {@code ddl-auto: update}
 * cannot perform. Notably: when {@code organizations.org_type} was an enum,
 * Hibernate added a CHECK constraint pinning it to the old enum values; now that
 * the column is a free string (admin-managed catalogue), that constraint would
 * reject any newly-added organisation type — so we drop it.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SchemaFixup implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        dropConstraint("organizations", "organizations_org_type_check");
        markGoogleAccountsWithoutPassword();
    }

    /**
     * Accounts created with Google before users.password_set existed hold a random
     * password: flag them so they can set one. Only touches NULL rows, once.
     */
    private void markGoogleAccountsWithoutPassword() {
        try {
            int n = jdbc.update("UPDATE users SET password_set = false WHERE password_set IS NULL AND auth_provider = 'GOOGLE'");
            if (n > 0) log.info("SchemaFixup: flagged {} Google account(s) as having no chosen password", n);
        } catch (Exception e) {
            log.warn("SchemaFixup: could not backfill users.password_set: {}", e.getMessage());
        }
    }

    private void dropConstraint(String table, String constraint) {
        try {
            jdbc.execute("ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS " + constraint);
            log.info("SchemaFixup: dropped constraint {} on {} (if present)", constraint, table);
        } catch (Exception e) {
            log.warn("SchemaFixup: could not drop {} on {}: {}", constraint, table, e.getMessage());
        }
    }
}
