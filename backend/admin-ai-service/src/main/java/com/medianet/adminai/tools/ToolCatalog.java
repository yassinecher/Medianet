package com.medianet.adminai.tools;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The list of tools exposed to the LLM, in OpenAI-compatible function-calling format.
 *
 * <p>Each tool has a logical name + input schema. The {@link com.medianet.adminai.service.ToolExecutor}
 * resolves these to upstream service calls. Tools split into:
 * <ul>
 *   <li><b>Read tools</b> — execute immediately, no confirmation.</li>
 *   <li><b>Write tools</b> — return a "pending action" the admin must confirm.</li>
 * </ul>
 *
 * <p>Compatible with HuggingFace Inference Providers and any OpenAI-API-compatible backend.
 */
public final class ToolCatalog {

    /** Write tools require explicit admin confirmation before they run. */
    public static final Set<String> WRITE_TOOLS = Set.of(
        // Programmes
        "create_programme",
        "update_programme",
        "delete_programme",
        "change_programme_status",
        // Phases (sessions)
        "add_programme_phase",
        "update_programme_phase",
        "delete_programme_phase",
        // Criteria
        "add_programme_criterion",
        "update_programme_criterion",
        "delete_programme_criterion",
        // Candidatures
        "accept_candidature",
        "reject_candidature",
        "assign_jury_to_candidature",
        // Tasks
        "create_task",
        "update_task",
        "change_task_status",
        "delete_task",
        // Partners
        "create_partner",
        "link_partner_to_programme",
        "unlink_partner_from_programme",
        // Invitations
        "resend_invitation",
        "cancel_invitation",
        // Notifications / users
        "send_email",
        "invite_user",
        "set_user_roles",
        "toggle_user_active",
        "update_landing_page",
        // Memory
        "remember_fact",
        "forget_fact"
    );

    public static boolean isWrite(String tool) {
        return WRITE_TOOLS.contains(tool);
    }

    /** Return the tool list in the exact JSON shape Anthropic's Messages API expects. */
    public static List<Map<String, Object>> toolsAsJson() {
        return List.of(
            // ── Read tools ────────────────────────────────────────────────
            tool("search_programmes",
                "Search programmes by status (DRAFT, OPEN, IN_PROGRESS, EVALUATION, CLOSED) or free text. " +
                "Returns id, title, status, dates, sectors, application deadline.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "status", Map.of("type", "string", "description", "Optional status filter"),
                        "query",  Map.of("type", "string", "description", "Optional text search across title/description")
                    )
                )),
            tool("get_programme",
                "Get full details of a single programme by id (criteria, phases, partners, form schema).",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "id", Map.of("type", "integer", "description", "Programme id")
                    ),
                    "required", List.of("id")
                )),
            tool("search_candidatures",
                "Search candidatures by status (PENDING, UNDER_EVALUATION, ACCEPTED, REJECTED) and/or programme.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "status",       Map.of("type", "string"),
                        "programmeId",  Map.of("type", "integer")
                    )
                )),
            tool("search_users",
                "Search users by role (PORTEUR, MENTOR, JURY, ADMIN). Returns id, name, email, roles.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "role", Map.of("type", "string", "description", "Optional role filter")
                    )
                )),
            tool("list_pending_actions",
                "List actions the AI has proposed that are still awaiting admin confirmation.",
                Map.of("type", "object", "properties", Map.of())),

            tool("get_landing_page",
                "Read the current landing page content (hero, stats, features, footer). " +
                "Call this BEFORE update_landing_page so you know the existing shape and don't overwrite fields.",
                Map.of("type", "object", "properties", Map.of())),

            tool("generate_landing_section",
                "Generate ready-to-use JSON content for ONE landing-page section (copywriting only — " +
                "no DB write, no confirmation needed). Returns a JSON object whose keys map directly onto " +
                "update_landing_page fields. PREFERRED workflow for landing-page content: " +
                "(1) generate_landing_section(section=\"hero\", brief=\"...\") → get polished JSON, " +
                "(2) optionally search_photos for any image fields, " +
                "(3) update_landing_page(patch={ ...generated JSON..., heroImageUrl: <photo url> }). " +
                "Sections: hero, about, process, testimonials, faq, cta, stats, features. " +
                "Call once per section. Much better than hand-writing the copy yourself.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "section", Map.of("type", "string",
                            "enum", List.of("hero", "about", "process", "testimonials", "faq", "cta", "stats", "features"),
                            "description", "Which section to write content for"),
                        "brief", Map.of("type", "string",
                            "description", "Optional context to steer the copy (tone, focus, programme name…). " +
                                "Leave empty for sensible Medianet defaults."),
                        "locale", Map.of("type", "string", "description", "Language code, default 'fr'")
                    ),
                    "required", List.of("section"))),

            tool("search_photos",
                "Find topical photos for the landing page, programmes, partner logos, etc. Tries Unsplash first " +
                "(curated, beautiful) if an Access Key is configured, falls back to OpenVerse (CC, no auth). " +
                "Returns items[] with a ready-to-use `url` field plus `thumbnail`, `credit`, `title`. " +
                "CRITICAL RULES: " +
                "(1) Copy `url` fields VERBATIM into your patches. NEVER construct your own image URLs. " +
                "(2) NEVER emit source.unsplash.com URLs — that endpoint is dead; the server rejects them. " +
                "(3) Use RICH english queries with 3+ words. Bad: 'tunisia'. " +
                "Good: 'tunisia tech startup founder', 'modern coworking office', 'young african entrepreneur smiling'. " +
                "(4) Set the `context` parameter so we return the right shape/style. " +
                "If photos feel off-topic, call again with a different query — don't apply bad ones.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "query", Map.of(
                            "type", "string",
                            "description", "Rich english search query, 3+ words preferred. " +
                                "Examples: 'tunisia tech startup founder', 'modern coworking office', " +
                                "'african woman entrepreneur', 'startup team meeting laptop'"),
                        "context", Map.of(
                            "type", "string",
                            "enum", List.of("hero", "feature", "partner_logo", "team", "abstract", "generic"),
                            "description", "Where this photo will be used. 'hero' = wide landing banner (1920x800), " +
                                "'feature' = card image (800x600), 'partner_logo' = square 400x400, " +
                                "'team' = portrait, 'abstract' = decorative background. Default: 'generic'."),
                        "count", Map.of("type", "integer", "description", "How many photos to return (1-8, default 4)"),
                        "width", Map.of("type", "integer", "description", "Override width in px (defaults from context)"),
                        "height", Map.of("type", "integer", "description", "Override height in px (defaults from context)")
                    ),
                    "required", List.of("query")
                )),

            // ── Write tools (require confirmation) ────────────────────────
            tool("create_programme",
                "Create a new programme. Status defaults to DRAFT. Admin must confirm before it runs.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "title",       Map.of("type", "string"),
                        "description", Map.of("type", "string"),
                        "type",        Map.of("type", "string", "description", "PUBLIC or PRIVATE"),
                        "sectors",     Map.of("type", "array", "items", Map.of("type", "string")),
                        "startDate",   Map.of("type", "string", "description", "ISO date YYYY-MM-DD"),
                        "endDate",     Map.of("type", "string", "description", "ISO date YYYY-MM-DD"),
                        "applicationDeadline", Map.of("type", "string", "description", "ISO date YYYY-MM-DD"),
                        "tagline",     Map.of("type", "string"),
                        "formTemplate", Map.of("type", "string", "description", "STANDARD | MINIMAL | FOODSTART | TECH | AGRITECH")
                    ),
                    "required", List.of("title")
                )),
            tool("update_programme",
                "Update top-level fields on an existing programme. The `patch` is a partial Programme object. " +
                "ALLOWED FIELDS in patch (anything else is SILENTLY IGNORED by the server): " +
                "title, description, type (PUBLIC|PRIVATE), status (DRAFT|OPEN|IN_PROGRESS|EVALUATION|CLOSED), " +
                "startDate, endDate, applicationDeadline (ISO YYYY-MM-DD), maxApplications (int), " +
                "sectors (string[]), tagline, logoUrl, bannerImageUrl, location, applicationUrl, " +
                "expertCount, trainingSessionsCount, mentoringHoursPerMonth, maxStartups (all int), " +
                "objectives (string[]), benefits (string[]), formTemplate (STANDARD|MINIMAL|FOODSTART|TECH|AGRITECH). " +
                "FORBIDDEN: NEVER put `phases`, `sessions`, `criteria`, `partners` here — they have their own tools " +
                "(add_programme_phase, add_programme_criterion). If you do, the patch will silently no-op.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "id", Map.of("type", "integer"),
                        "patch", Map.of("type", "object",
                            "description", "Partial programme object — top-level fields ONLY (see description above)")
                    ),
                    "required", List.of("id", "patch")
                )),
            tool("add_programme_phase",
                "Add a phase (= session, event, week, or step) to an existing programme. Use this to build " +
                "the programme timeline. One call per phase. The admin must confirm each one.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "title",       Map.of("type", "string", "description", "Phase title, e.g. 'Onboarding', 'Pitch Day'"),
                        "description", Map.of("type", "string"),
                        "startDate",   Map.of("type", "string", "description", "ISO YYYY-MM-DD"),
                        "endDate",     Map.of("type", "string", "description", "ISO YYYY-MM-DD (same as startDate for single-day events)"),
                        "location",    Map.of("type", "string", "description", "Where it happens — venue or 'Online'"),
                        "durationKind", Map.of("type", "string", "description", "day | week | custom")
                    ),
                    "required", List.of("programmeId", "title")
                )),
            tool("add_programme_criterion",
                "Add an evaluation criterion to an existing programme. Used to score candidatures. " +
                "Weight is 0.0–1.0 — sum of all active criteria of a programme should equal 1.0.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "name",        Map.of("type", "string"),
                        "description", Map.of("type", "string"),
                        "weight",      Map.of("type", "number", "description", "0.0 to 1.0")
                    ),
                    "required", List.of("programmeId", "name", "weight")
                )),
            tool("change_programme_status",
                "Change a programme's lifecycle status (DRAFT -> OPEN -> EVALUATION -> CLOSED, etc.).",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "id",     Map.of("type", "integer"),
                        "status", Map.of("type", "string")
                    ),
                    "required", List.of("id", "status")
                )),
            tool("create_task",
                "Create a task on a programme, assigned to a user.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "programmeId",      Map.of("type", "integer"),
                        "assignedToUserId", Map.of("type", "integer"),
                        "title",            Map.of("type", "string"),
                        "description",      Map.of("type", "string"),
                        "dueDate",          Map.of("type", "string"),
                        "priority",         Map.of("type", "string", "description", "LOW|MEDIUM|HIGH|URGENT")
                    ),
                    "required", List.of("programmeId", "assignedToUserId", "title")
                )),
            tool("send_email",
                "Send a freeform email to one or more addresses.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "toEmails", Map.of("type", "array", "items", Map.of("type", "string")),
                        "subject",  Map.of("type", "string"),
                        "body",     Map.of("type", "string")
                    ),
                    "required", List.of("toEmails", "subject", "body")
                )),
            tool("invite_user",
                "Send an invitation to a future Juré / Mentor / Porteur — they'll receive an email to create their account.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "type",            Map.of("type", "string", "description", "JURY | MENTOR | PORTEUR"),
                        "recipientEmail",  Map.of("type", "string"),
                        "recipientName",   Map.of("type", "string"),
                        "programmeId",     Map.of("type", "integer"),
                        "subject",         Map.of("type", "string"),
                        "message",         Map.of("type", "string")
                    ),
                    "required", List.of("type", "recipientEmail", "subject", "message")
                )),
            tool("set_user_roles",
                "Replace the full set of roles assigned to a user (PORTEUR/MENTOR/JURY/ADMIN).",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "userId", Map.of("type", "integer"),
                        "roles",  Map.of("type", "array", "items", Map.of("type", "string"))
                    ),
                    "required", List.of("userId", "roles")
                )),
            tool("toggle_user_active",
                "Toggle a user's active status (enable / disable login).",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "userId", Map.of("type", "integer")
                    ),
                    "required", List.of("userId")
                )),
            tool("update_landing_page",
                "Update the public landing page. The `patch` argument MUST be a real JSON OBJECT (not a string). " +
                "Schema of LandingPage: " +
                "{ " +
                "  heroTitle?: string, heroSubtitle?: string, heroBadge?: string, heroImageUrl?: string, " +
                "  primaryCtaLabel?: string, primaryCtaLink?: string, secondaryCtaLabel?: string, secondaryCtaLink?: string, " +
                "  stats?: [{ label: string, value: number, suffix?: string }], " +
                "  features?: [{ title: string, description: string, icon?: string, imageUrl?: string }], " +
                "  ctaTitle?: string, ctaSubtitle?: string, ctaButtonLabel?: string, ctaButtonLink?: string, " +
                "  footerText?: string " +
                "}. " +
                "IMPORTANT: features is an ARRAY (not feature1ImageUrl/feature2ImageUrl). " +
                "To replace all 4 feature images, send a `features` array with 4 objects each having an `imageUrl`. " +
                "Always call get_landing_page first if you need the current content to preserve other fields.",
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "patch", Map.of(
                            "type", "object",
                            "description", "Partial LandingPage JSON object (NOT a string). Only the fields you want to change."
                        )
                    ),
                    "required", List.of("patch")
                )),

            // ════════════════════════════════════════════════════════════════
            // CANDIDATURES — read + decision tools
            // ════════════════════════════════════════════════════════════════
            tool("get_candidature",
                "Get full details of a single candidature (project info, applicant, scores, jury comments).",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),
            tool("accept_candidature",
                "Accept a candidature. Status becomes ACCEPTED. Optionally include a comment.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "id", Map.of("type", "integer"),
                        "comment", Map.of("type", "string", "description", "Optional acceptance note for the candidate")
                    ),
                    "required", List.of("id"))),
            tool("reject_candidature",
                "Reject a candidature. Status becomes REJECTED. Optionally include a comment.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "id", Map.of("type", "integer"),
                        "comment", Map.of("type", "string", "description", "Optional rejection reason for the candidate")
                    ),
                    "required", List.of("id"))),
            tool("assign_jury_to_candidature",
                "Assign a JURY user to evaluate a specific candidature.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "candidatureId", Map.of("type", "integer"),
                        "juryUserId",    Map.of("type", "integer")
                    ),
                    "required", List.of("candidatureId", "juryUserId"))),

            // ════════════════════════════════════════════════════════════════
            // TASKS — full CRUD
            // ════════════════════════════════════════════════════════════════
            tool("search_tasks",
                "List tasks, optionally filtered by status (PENDING|IN_PROGRESS|COMPLETED|CANCELLED), " +
                "programmeId, or assignedToUserId.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "status",           Map.of("type", "string"),
                        "programmeId",      Map.of("type", "integer"),
                        "assignedToUserId", Map.of("type", "integer")
                    ))),
            tool("get_task",
                "Get full details of a single task.",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),
            tool("update_task",
                "Update a task. The `patch` object can contain: title, description, dueDate (ISO), " +
                "priority (LOW|MEDIUM|HIGH|URGENT), assignedToUserId.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "id", Map.of("type", "integer"),
                        "patch", Map.of("type", "object")
                    ),
                    "required", List.of("id", "patch"))),
            tool("change_task_status",
                "Change a task's status. Use COMPLETED to mark it done.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "id",     Map.of("type", "integer"),
                        "status", Map.of("type", "string", "description", "PENDING|IN_PROGRESS|COMPLETED|CANCELLED")
                    ),
                    "required", List.of("id", "status"))),
            tool("delete_task",
                "Permanently delete a task. Use cancel_task (change_task_status to CANCELLED) instead if you want to keep history.",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),

            // ════════════════════════════════════════════════════════════════
            // PROGRAMME — completing CRUD
            // ════════════════════════════════════════════════════════════════
            tool("delete_programme",
                "PERMANENTLY delete a programme + all its phases, criteria, partner links, and candidatures. " +
                "Highly destructive — only suggest this for DRAFT programmes the admin wants to discard.",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),
            tool("update_programme_phase",
                "Edit an existing phase. Patch fields: title, description, startDate, endDate, status, " +
                "location, durationKind, responsibles, guests, startupIds, tasks.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "phaseId",     Map.of("type", "integer"),
                        "patch",       Map.of("type", "object")
                    ),
                    "required", List.of("programmeId", "phaseId", "patch"))),
            tool("delete_programme_phase",
                "Remove a phase from a programme.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "phaseId",     Map.of("type", "integer")
                    ),
                    "required", List.of("programmeId", "phaseId"))),
            tool("update_programme_criterion",
                "Edit an existing criterion. Patch fields: name, description, weight (0-1), active.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "criterionId", Map.of("type", "integer"),
                        "patch",       Map.of("type", "object")
                    ),
                    "required", List.of("programmeId", "criterionId", "patch"))),
            tool("delete_programme_criterion",
                "Remove an evaluation criterion from a programme.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "criterionId", Map.of("type", "integer")
                    ),
                    "required", List.of("programmeId", "criterionId"))),

            // ════════════════════════════════════════════════════════════════
            // PARTNERS — library + link management
            // ════════════════════════════════════════════════════════════════
            tool("list_partners",
                "List all partner organisations available in the library.",
                Map.of("type", "object", "properties", Map.of())),
            tool("create_partner",
                "Add a new partner to the global library. Re-usable across programmes.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "name",    Map.of("type", "string"),
                        "logoUrl", Map.of("type", "string", "description", "Optional logo URL")
                    ),
                    "required", List.of("name"))),
            tool("link_partner_to_programme",
                "Attach an existing partner to a programme.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "partnerId",   Map.of("type", "integer")
                    ),
                    "required", List.of("programmeId", "partnerId"))),
            tool("unlink_partner_from_programme",
                "Remove a partner from a programme (partner stays in the library).",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "partnerId",   Map.of("type", "integer")
                    ),
                    "required", List.of("programmeId", "partnerId"))),

            // ════════════════════════════════════════════════════════════════
            // USERS / INVITATIONS — completion
            // ════════════════════════════════════════════════════════════════
            tool("get_user",
                "Get full details of one user (profile, roles, permissions, active status).",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),
            tool("list_invitations",
                "List invitations (sent to future jurés/mentors/porteurs). Filter by programmeId and/or status.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "programmeId", Map.of("type", "integer"),
                        "status",      Map.of("type", "string", "description", "PENDING|ACCEPTED|DECLINED|EXPIRED")
                    ))),
            tool("resend_invitation",
                "Re-send an invitation email (resets the token expiry).",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),
            tool("cancel_invitation",
                "Cancel an invitation that hasn't been accepted yet.",
                Map.of("type", "object",
                    "properties", Map.of("id", Map.of("type", "integer")),
                    "required", List.of("id"))),

            // ════════════════════════════════════════════════════════════════
            // MEMORY — admin-curated persistent facts injected into every prompt
            // ════════════════════════════════════════════════════════════════
            tool("list_facts",
                "List all facts you've memorized about the platform. Read-only.",
                Map.of("type", "object", "properties", Map.of())),
            tool("remember_fact",
                "Persist a fact about the platform / admin preferences. Survives across " +
                "conversations and is injected into your system prompt on every chat. " +
                "Use a short snake_case key and a clear value. Examples: " +
                "remember_fact(\"default_programme_duration\", \"6 months\", \"preferences\"), " +
                "remember_fact(\"team_email\", \"contact@medianet.tn\", \"team\").",
                Map.of("type", "object",
                    "properties", Map.of(
                        "key",      Map.of("type", "string", "description", "Short snake_case identifier"),
                        "value",    Map.of("type", "string", "description", "Free-form fact value"),
                        "category", Map.of("type", "string", "description", "Optional: platform | team | preferences | tone | general")
                    ),
                    "required", List.of("key", "value"))),
            tool("forget_fact",
                "Remove a fact from memory by its key. Use when the admin says it's no longer true.",
                Map.of("type", "object",
                    "properties", Map.of("key", Map.of("type", "string")),
                    "required", List.of("key"))),

            // ════════════════════════════════════════════════════════════════
            // CLARIFY — ask the admin a multi-choice question (UI renders chips)
            // ════════════════════════════════════════════════════════════════
            tool("ask_user_choice",
                "Ask the admin to pick from a short list of options when their request is " +
                "ambiguous. The UI renders this as clickable chips (radio if multiSelect=false, " +
                "checkboxes if true) — the admin's choice becomes their next message. " +
                "USE THIS instead of asking a free-text clarification question. Examples: " +
                "user says 'envoie un email aux candidats' → ask_user_choice( " +
                "question='À quels candidats ?', " +
                "options=[{label:'Acceptés'},{label:'En évaluation'},{label:'Refusés'}], " +
                "multiSelect=true). " +
                "Keep options short (2-6), labels concise (1-5 words), descriptions optional. " +
                "Calling this tool ENDS the current turn — you'll get the admin's selection " +
                "as the next user message.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "question", Map.of("type", "string",
                            "description", "Plain-language question (e.g. 'Quel statut filtrer ?')"),
                        "options", Map.of("type", "array",
                            "description", "2-6 choices",
                            "items", Map.of("type", "object",
                                "properties", Map.of(
                                    "label",       Map.of("type", "string"),
                                    "description", Map.of("type", "string", "description", "Optional one-liner")
                                ),
                                "required", List.of("label"))),
                        "multiSelect", Map.of("type", "boolean",
                            "description", "true = checkboxes (admin can pick several), false = radio (one only). Default false.")
                    ),
                    "required", List.of("question", "options"))),

            // ════════════════════════════════════════════════════════════════
            // PLAN — propose a full multi-step plan that the admin reviews in
            // one wizard form (instead of confirming each pending action).
            // ════════════════════════════════════════════════════════════════
            tool("propose_plan",
                "PREFERRED way to handle multi-step requests like 'crée un programme complet'. " +
                "Builds a wizard the admin reviews + tweaks ONCE, then executes all steps as a batch " +
                "(no per-step Confirm clicks). Each step has a tool name + args + an optional flag. " +
                "If a step depends on an entity created by an earlier step, set dependsOnStep (the " +
                "index of the producing step, 0-based) and fillField (the arg name to back-fill with " +
                "the real id). The server resolves these at execute time. " +
                "Use this INSTEAD of emitting multiple write tool_calls when the admin asks for " +
                "anything multi-action (a complete programme, a landing page setup, a campaign of " +
                "invitations, etc.). Calling this ENDS the current turn — the UI handles the rest.",
                Map.of("type", "object",
                    "properties", Map.of(
                        "title", Map.of("type", "string",
                            "description", "Short header for the wizard, e.g. 'Programme FoodTech 2026'"),
                        "summary", Map.of("type", "string",
                            "description", "Optional 1-2 sentence overview"),
                        "steps", Map.of("type", "array",
                            "description", "Ordered list of steps",
                            "items", Map.of("type", "object",
                                "properties", Map.of(
                                    "label",        Map.of("type", "string", "description", "Human label"),
                                    "tool",         Map.of("type", "string", "description", "Tool name e.g. create_programme"),
                                    "args",         Map.of("type", "object", "description", "Args for the tool"),
                                    "optional",     Map.of("type", "boolean", "description", "true = admin can uncheck"),
                                    "dependsOnStep",Map.of("type", "integer", "description", "Index (0-based) of an earlier step that creates an entity referenced here"),
                                    "fillField",    Map.of("type", "string", "description", "Arg name to back-fill with the dependency's returned id (e.g. 'programmeId')")
                                ),
                                "required", List.of("label", "tool")))
                    ),
                    "required", List.of("title", "steps")))
        );
    }

    /** Wraps a tool definition in the OpenAI function-calling envelope. */
    private static Map<String, Object> tool(String name, String description, Map<String, Object> inputSchema) {
        return Map.of(
            "type", "function",
            "function", Map.of(
                "name", name,
                "description", description,
                "parameters", inputSchema
            )
        );
    }

    private ToolCatalog() {}
}
