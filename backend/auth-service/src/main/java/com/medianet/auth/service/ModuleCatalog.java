package com.medianet.auth.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Single source of truth for the permission modules: which modules exist, how
 * they are labelled/described for humans, and whether they are platform
 * capabilities (GENERAL — grantable to anyone) or administration permissions
 * (ADMIN — back-office access, grantable by administrators only).
 *
 * <p>Used by the boot seeder (permission rows carry label + scope from here)
 * and by the grouped permission-catalog endpoint that drives both frontends.
 */
public final class ModuleCatalog {

    private ModuleCatalog() {}

    /** A module and the CRUD actions it exposes (some modules are read-only). */
    public record ModuleDef(String key, String label, String description, String scope,
                            List<String> actions) {
        public ModuleDef(String key, String label, String description, String scope) {
            this(key, label, description, scope, List.of("read", "create", "update", "delete"));
        }
    }

    /** CRUD action key → French label. */
    public static final Map<String, String> ACTION_LABELS = Map.of(
            "read",   "Voir",
            "create", "Créer",
            "update", "Modifier",
            "delete", "Supprimer");

    public static final String SCOPE_GENERAL = "GENERAL";
    public static final String SCOPE_ADMIN   = "ADMIN";

    /** Platform modules first, then administration modules. */
    public static final List<ModuleDef> MODULES = List.of(
        // ── Plateforme (attribuables à tout utilisateur) ─────────────────────
        new ModuleDef("programmes",    "Programmes",
                "Programmes d'incubation : catalogue, contenu et cycle de vie", SCOPE_GENERAL),
        new ModuleDef("candidatures",  "Candidatures",
                "Dossiers de candidature : consultation, dépôt et suivi", SCOPE_GENERAL),
        new ModuleDef("sessions",      "Sessions & parcours",
                "Sessions, journées et activités des programmes", SCOPE_GENERAL),
        new ModuleDef("tasks",         "Tâches",
                "Tâches et suivi d'avancement des startups incubées", SCOPE_GENERAL),
        new ModuleDef("organizations", "Organisations",
                "Startups, partenaires et leurs membres", SCOPE_GENERAL),

        // ── Administration (accès back-office, réservé aux administrateurs) ──
        new ModuleDef("dashboard",     "Tableau de bord",
                "Vue d'ensemble et statistiques du back-office", SCOPE_ADMIN),
        new ModuleDef("reports",       "Rapports & statistiques",
                "Statistiques détaillées : utilisateurs, candidatures, programmes, invitations",
                SCOPE_ADMIN, List.of("read")),
        new ModuleDef("users",         "Utilisateurs",
                "Gestion des comptes : données, rôles et permissions", SCOPE_ADMIN),
        new ModuleDef("roles",         "Rôles",
                "Définition des rôles et de leurs permissions", SCOPE_ADMIN),
        new ModuleDef("notifications", "Invitations & emails",
                "Invitations, contacts et envois d'emails", SCOPE_ADMIN),
        new ModuleDef("landing",       "Page d'accueil",
                "Contenu de la page d'accueil publique", SCOPE_ADMIN),
        new ModuleDef("ai",            "Assistant IA",
                "Assistant IA d'administration et scoring", SCOPE_ADMIN),
        new ModuleDef("settings",      "Paramètres & référentiels",
                "Paramètres de la plateforme et listes de référence", SCOPE_ADMIN)
    );

    /**
     * Extra (non-CRUD) permissions: slug → {label, scope}. They belong to the
     * module named by their slug prefix.
     */
    public record SpecialDef(String slug, String label, String scope) {}
    public static final List<SpecialDef> SPECIALS = List.of(
        new SpecialDef("candidatures:evaluate", "Évaluer les candidatures (jury)",        SCOPE_GENERAL),
        new SpecialDef("candidatures:decide",   "Accepter / rejeter les candidatures",    SCOPE_ADMIN)
    );

    /** Every slug the catalog defines — anything else in the DB is stale and gets pruned. */
    public static java.util.Set<String> expectedSlugs() {
        java.util.Set<String> out = new java.util.HashSet<>();
        for (ModuleDef m : MODULES) {
            for (String action : m.actions()) out.add(m.key() + ":" + action);
        }
        for (SpecialDef s : SPECIALS) out.add(s.slug());
        return out;
    }

    public static Optional<ModuleDef> byKey(String key) {
        return MODULES.stream().filter(m -> m.key().equals(key)).findFirst();
    }

    public static Map<String, ModuleDef> byKeyMap() {
        return MODULES.stream().collect(Collectors.toMap(ModuleDef::key, m -> m));
    }
}
