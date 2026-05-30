package com.medianet.adminai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.adminai.client.UpstreamClient;
import com.medianet.adminai.entity.AdminAction;
import com.medianet.adminai.repository.AdminActionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Executes a tool by routing it to the right upstream service.
 *
 * <p>Read tools run immediately. Write tools call this only after the admin
 * confirms the proposed action — see {@link AdminAiService#confirmAction}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ToolExecutor {

    private final UpstreamClient upstream;
    private final AdminActionRepository actionRepo;
    private final AiSettingsService aiSettings;
    private final com.medianet.adminai.repository.AiMemoryRepository memoryRepo;
    private final ObjectMapper json = new ObjectMapper();

    /**
     * Run a tool by name with its argument map. Returns the upstream response
     * (or a small status map for actions that don't return anything useful).
     */
    @SuppressWarnings("unchecked")
    public Object run(String tool, Map<String, Object> args, String adminToken) {
        // LLMs sometimes pass nested JSON as a STRING instead of a real JSON object.
        // Auto-fix common cases (patch, body, data...) by re-parsing them.
        args = normalizeStringifiedObjects(args);

        // Block dead image URLs the LLM might have hallucinated. Throws if found
        // — the AI sees a clear error and is forced to call search_photos properly.
        validateNoDeadImageUrls(args);

        return switch (tool) {
            // ── Reads ──────────────────────────────────────────────────────
            case "search_programmes" -> {
                String url = upstream.programme() + "/api/programmes";
                if (args.get("status") != null) url += "?status=" + args.get("status");
                yield upstream.get(url, adminToken);
            }
            case "get_programme" ->
                upstream.get(upstream.programme() + "/api/programmes/" + intArg(args, "id"), adminToken);

            case "search_candidatures" -> {
                String url = upstream.candidature() + "/api/candidatures";
                if (args.get("programmeId") != null) url = upstream.candidature() + "/api/candidatures/programme/" + intArg(args, "programmeId");
                if (args.get("status") != null) url += (url.contains("?") ? "&" : "?") + "status=" + args.get("status");
                yield upstream.get(url, adminToken);
            }
            case "search_users" -> {
                String url = args.get("role") != null
                        ? upstream.auth() + "/api/auth/users/role/" + args.get("role")
                        : upstream.auth() + "/api/auth/users";
                yield upstream.get(url, adminToken);
            }
            case "list_pending_actions" ->
                actionRepo.findByStatusOrderByCreatedAtDesc(
                    com.medianet.adminai.entity.ActionStatus.PENDING);

            case "get_landing_page" ->
                upstream.get(upstream.programme() + "/api/landing-page", adminToken);

            case "search_photos" -> searchPhotos(args);

            // ── Writes ─────────────────────────────────────────────────────
            case "create_programme" ->
                upstream.post(upstream.programme() + "/api/programmes", args, adminToken);

            case "update_programme" -> {
                Long id = longArg(args, "id");
                Object patch = args.get("patch");
                yield upstream.put(upstream.programme() + "/api/programmes/" + id, patch, adminToken);
            }

            case "change_programme_status" -> {
                Long id = longArg(args, "id");
                String status = (String) args.get("status");
                yield upstream.patch(upstream.programme() + "/api/programmes/" + id + "/status",
                                     Map.of("status", status), adminToken);
            }

            case "add_programme_phase" -> {
                Long programmeId = longArg(args, "programmeId");
                Map<String, Object> body = new java.util.LinkedHashMap<>(args);
                body.remove("programmeId");
                yield upstream.post(upstream.programme() + "/api/programmes/" + programmeId + "/phases",
                                    body, adminToken);
            }

            case "add_programme_criterion" -> {
                Long programmeId = longArg(args, "programmeId");
                Map<String, Object> body = new java.util.LinkedHashMap<>(args);
                body.remove("programmeId");
                yield upstream.post(upstream.programme() + "/api/programmes/" + programmeId + "/criteria",
                                    body, adminToken);
            }

            case "create_task" ->
                upstream.post(upstream.programme() + "/api/tasks", args, adminToken);

            case "send_email" ->
                upstream.post(upstream.notification() + "/api/notifications/email/send", args, adminToken);

            case "invite_user" ->
                upstream.post(upstream.notification() + "/api/notifications/invitations", args, adminToken);

            case "set_user_roles" -> {
                Long userId = longArg(args, "userId");
                Object roles = args.get("roles");
                yield upstream.put(upstream.auth() + "/api/auth/users/" + userId + "/roles",
                                   Map.of("roles", roles), adminToken);
            }

            case "toggle_user_active" -> {
                Long userId = longArg(args, "userId");
                yield upstream.patch(upstream.auth() + "/api/auth/users/" + userId + "/toggle-active",
                                     Map.of(), adminToken);
            }

            case "update_landing_page" ->
                upstream.put(upstream.programme() + "/api/landing-page", args.get("patch"), adminToken);

            // ── Candidatures ───────────────────────────────────────────────
            case "get_candidature" ->
                upstream.get(upstream.candidature() + "/api/candidatures/" + intArg(args, "id"), adminToken);

            case "accept_candidature" -> {
                Long id = longArg(args, "id");
                Map<String, Object> body = args.get("comment") != null ? Map.of("comment", args.get("comment")) : Map.of();
                yield upstream.patch(upstream.candidature() + "/api/candidatures/" + id + "/accept",
                                     body, adminToken);
            }

            case "reject_candidature" -> {
                Long id = longArg(args, "id");
                Map<String, Object> body = args.get("comment") != null ? Map.of("comment", args.get("comment")) : Map.of();
                yield upstream.patch(upstream.candidature() + "/api/candidatures/" + id + "/reject",
                                     body, adminToken);
            }

            case "assign_jury_to_candidature" -> {
                Long candidatureId = longArg(args, "candidatureId");
                Long juryUserId    = longArg(args, "juryUserId");
                yield upstream.post(upstream.candidature() + "/api/candidatures/" + candidatureId + "/assign-jury",
                                    Map.of("juryUserId", juryUserId), adminToken);
            }

            // ── Tasks ──────────────────────────────────────────────────────
            case "search_tasks" -> {
                StringBuilder url = new StringBuilder(upstream.programme() + "/api/tasks");
                java.util.List<String> qp = new java.util.ArrayList<>();
                if (args.get("status")           != null) qp.add("status=" + args.get("status"));
                if (args.get("programmeId")      != null) qp.add("programmeId=" + args.get("programmeId"));
                if (args.get("assignedToUserId") != null) qp.add("assignedToUserId=" + args.get("assignedToUserId"));
                if (!qp.isEmpty()) url.append("?").append(String.join("&", qp));
                yield upstream.get(url.toString(), adminToken);
            }

            case "get_task" ->
                upstream.get(upstream.programme() + "/api/tasks/" + intArg(args, "id"), adminToken);

            case "update_task" -> {
                Long id = longArg(args, "id");
                yield upstream.put(upstream.programme() + "/api/tasks/" + id, args.get("patch"), adminToken);
            }

            case "change_task_status" -> {
                Long id = longArg(args, "id");
                String status = (String) args.get("status");
                yield upstream.patch(upstream.programme() + "/api/tasks/" + id + "/status",
                                     Map.of("status", status), adminToken);
            }

            case "delete_task" ->
                upstream.delete(upstream.programme() + "/api/tasks/" + intArg(args, "id"), adminToken);

            // ── Programme — complete CRUD ──────────────────────────────────
            case "delete_programme" ->
                upstream.delete(upstream.programme() + "/api/programmes/" + intArg(args, "id"), adminToken);

            case "update_programme_phase" -> {
                Long pid = longArg(args, "programmeId");
                Long phid = longArg(args, "phaseId");
                yield upstream.put(upstream.programme() + "/api/programmes/" + pid + "/phases/" + phid,
                                   args.get("patch"), adminToken);
            }

            case "delete_programme_phase" -> {
                Long pid = longArg(args, "programmeId");
                Long phid = longArg(args, "phaseId");
                yield upstream.delete(upstream.programme() + "/api/programmes/" + pid + "/phases/" + phid,
                                      adminToken);
            }

            case "update_programme_criterion" -> {
                Long pid = longArg(args, "programmeId");
                Long cid = longArg(args, "criterionId");
                yield upstream.put(upstream.programme() + "/api/programmes/" + pid + "/criteria/" + cid,
                                   args.get("patch"), adminToken);
            }

            case "delete_programme_criterion" -> {
                Long pid = longArg(args, "programmeId");
                Long cid = longArg(args, "criterionId");
                yield upstream.delete(upstream.programme() + "/api/programmes/" + pid + "/criteria/" + cid,
                                      adminToken);
            }

            // ── Partners ───────────────────────────────────────────────────
            case "list_partners" ->
                upstream.get(upstream.programme() + "/api/partners", adminToken);

            case "create_partner" -> {
                Map<String, Object> body = new java.util.LinkedHashMap<>();
                body.put("name", args.get("name"));
                if (args.get("logoUrl") != null) body.put("logoUrl", args.get("logoUrl"));
                yield upstream.post(upstream.programme() + "/api/partners", body, adminToken);
            }

            case "link_partner_to_programme" -> {
                Long pid = longArg(args, "programmeId");
                Long prtid = longArg(args, "partnerId");
                yield upstream.post(upstream.programme() + "/api/programmes/" + pid + "/partners/" + prtid,
                                    Map.of(), adminToken);
            }

            case "unlink_partner_from_programme" -> {
                Long pid = longArg(args, "programmeId");
                Long prtid = longArg(args, "partnerId");
                yield upstream.delete(upstream.programme() + "/api/programmes/" + pid + "/partners/" + prtid,
                                      adminToken);
            }

            // ── Users + Invitations ────────────────────────────────────────
            case "get_user" ->
                upstream.get(upstream.auth() + "/api/auth/users/" + intArg(args, "id"), adminToken);

            case "list_invitations" -> {
                StringBuilder url = new StringBuilder(upstream.notification() + "/api/notifications/invitations");
                java.util.List<String> qp = new java.util.ArrayList<>();
                if (args.get("status")      != null) qp.add("status=" + args.get("status"));
                if (args.get("programmeId") != null) {
                    // Backend has a dedicated endpoint for this filter
                    url = new StringBuilder(upstream.notification() + "/api/notifications/invitations/programme/" + args.get("programmeId"));
                }
                if (!qp.isEmpty()) url.append(url.indexOf("?") >= 0 ? "&" : "?").append(String.join("&", qp));
                yield upstream.get(url.toString(), adminToken);
            }

            case "resend_invitation" ->
                upstream.post(upstream.notification() + "/api/notifications/invitations/" + intArg(args, "id") + "/resend",
                              Map.of(), adminToken);

            case "cancel_invitation" ->
                upstream.delete(upstream.notification() + "/api/notifications/invitations/" + intArg(args, "id"),
                                adminToken);

            // ── Memory ─────────────────────────────────────────────────────
            case "list_facts" -> {
                java.util.List<com.medianet.adminai.entity.AiMemory> all = memoryRepo.findAllByOrderByCategoryAscFactKeyAsc();
                java.util.List<Map<String, Object>> facts = new java.util.ArrayList<>();
                for (var f : all) {
                    facts.add(Map.of("key", f.getFactKey(), "value", f.getFactValue(),
                                     "category", f.getCategory()));
                }
                yield Map.of("count", facts.size(), "facts", facts);
            }

            case "remember_fact" -> {
                String key = (String) args.get("key");
                String val = (String) args.get("value");
                String cat = args.get("category") != null ? String.valueOf(args.get("category")) : "general";
                if (key == null || key.isBlank()) yield Map.of("error", "key requis");
                if (val == null || val.isBlank()) yield Map.of("error", "value requis");
                var existing = memoryRepo.findByFactKey(key).orElse(null);
                var mem = existing != null ? existing
                        : com.medianet.adminai.entity.AiMemory.builder().factKey(key).build();
                mem.setFactValue(val);
                mem.setCategory(cat);
                memoryRepo.save(mem);
                yield Map.of("status", "saved", "key", key, "value", val, "category", cat);
            }

            case "forget_fact" -> {
                String key = (String) args.get("key");
                if (key == null || key.isBlank()) yield Map.of("error", "key requis");
                if (!memoryRepo.findByFactKey(key).isPresent())
                    yield Map.of("status", "not_found", "key", key);
                memoryRepo.deleteByFactKey(key);
                yield Map.of("status", "forgotten", "key", key);
            }

            default -> Map.of("error", "Outil inconnu : " + tool);
        };
    }

    /**
     * For each write tool, return enough JSON to undo it later.
     * Returns null if the action isn't easily revertible.
     */
    public String captureBeforeState(String tool, Map<String, Object> args, String adminToken) {
        try {
            return switch (tool) {
                case "update_programme",
                     "change_programme_status" -> stringify(upstream.get(
                         upstream.programme() + "/api/programmes/" + intArg(args, "id"), adminToken));
                case "set_user_roles",
                     "toggle_user_active" -> stringify(upstream.get(
                         upstream.auth() + "/api/auth/users/" + intArg(args, "userId"), adminToken));
                case "update_landing_page" -> stringify(upstream.get(
                         upstream.programme() + "/api/landing-page", adminToken));
                default -> null;
            };
        } catch (Exception e) {
            log.warn("Could not capture before-state for {}: {}", tool, e.getMessage());
            return null;
        }
    }

    /**
     * Revert a previously-executed write action.
     */
    @SuppressWarnings("unchecked")
    public void revert(AdminAction action, String adminToken) {
        String tool = action.getTool();
        Map<String, Object> args = parseArgs(action.getArgsJson());
        Map<String, Object> before = parseArgs(action.getBeforeStateJson());
        Map<String, Object> result = parseArgs(action.getResultJson());

        switch (tool) {
            case "create_programme" -> {
                Long id = result != null ? longOf(result.get("id")) : null;
                if (id != null) upstream.delete(upstream.programme() + "/api/programmes/" + id, adminToken);
            }
            case "create_task" -> {
                Long id = result != null ? longOf(result.get("id")) : null;
                if (id != null) upstream.delete(upstream.programme() + "/api/tasks/" + id, adminToken);
            }
            case "update_programme" -> {
                Long id = longArg(args, "id");
                if (before != null) upstream.put(upstream.programme() + "/api/programmes/" + id, before, adminToken);
            }
            case "change_programme_status" -> {
                Long id = longArg(args, "id");
                String prevStatus = before != null ? (String) before.get("status") : null;
                if (id != null && prevStatus != null)
                    upstream.patch(upstream.programme() + "/api/programmes/" + id + "/status",
                                   Map.of("status", prevStatus), adminToken);
            }
            case "set_user_roles" -> {
                Long uid = longArg(args, "userId");
                Object prevRoles = before != null ? before.get("roles") : null;
                if (uid != null && prevRoles != null)
                    upstream.put(upstream.auth() + "/api/auth/users/" + uid + "/roles",
                                 Map.of("roles", prevRoles), adminToken);
            }
            case "toggle_user_active" -> {
                Long uid = longArg(args, "userId");
                if (uid != null) upstream.patch(upstream.auth() + "/api/auth/users/" + uid + "/toggle-active",
                                                Map.of(), adminToken);
            }
            case "update_landing_page" -> {
                if (before != null) upstream.put(upstream.programme() + "/api/landing-page", before, adminToken);
            }
            case "invite_user" -> {
                Long id = result != null ? longOf(result.get("id")) : null;
                if (id != null) upstream.delete(upstream.notification() + "/api/notifications/invitations/" + id, adminToken);
            }
            case "send_email" -> {
                throw new IllegalStateException("Les emails déjà envoyés ne peuvent pas être annulés.");
            }
            default -> throw new IllegalStateException("Pas de procédure d'annulation pour : " + tool);
        }
    }

    /** Used by searchPhotos to verify image URLs are reachable before returning them. */
    private final java.net.http.HttpClient photoClient = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(5))
            .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
            .build();

    /** Quickly HEAD the URL to see if it serves an image. Treats redirects as success. */
    private boolean photoUrlIsReachable(String url) {
        try {
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .method("HEAD", java.net.http.HttpRequest.BodyPublishers.noBody())
                    .build();
            java.net.http.HttpResponse<Void> resp = photoClient.send(req, java.net.http.HttpResponse.BodyHandlers.discarding());
            return resp.statusCode() >= 200 && resp.statusCode() < 400;
        } catch (Exception e) {
            log.debug("Photo HEAD failed for {}: {}", url, e.getMessage());
            return false;
        }
    }

    /**
     * Return a small list of working photo URLs matching the query.
     *
     * <p>Source priority:
     * <ol>
     *   <li><b>Pexels</b> — curated, free 20K req/month. Preferred when key is set.</li>
     *   <li><b>Unsplash</b> — curated, beautiful, 50 req/hour with Access Key.</li>
     *   <li><b>OpenVerse</b> — Creative Commons aggregator, no auth, topical but variable quality.</li>
     *   <li><b>Lorem Picsum</b> — deterministic but NOT topical; only used to top up the result list.</li>
     * </ol>
     *
     * <p>The previous {@code source.unsplash.com} endpoint was sunset by Unsplash in 2024
     * and is no longer used — it returned 503/404 for every request.
     */
    private Map<String, Object> searchPhotos(Map<String, Object> args) {
        String rawQuery  = String.valueOf(args.getOrDefault("query", "incubator")).trim();
        String context   = String.valueOf(args.getOrDefault("context", "generic")).toLowerCase().trim();
        int    count     = Math.min(8, Math.max(1, intArg(args, "count") != null ? intArg(args, "count") : 4));

        // Context-aware aspect / size defaults
        ContextSpec spec = contextSpec(context);
        int width  = intArg(args, "width")  != null ? intArg(args, "width")  : spec.width;
        int height = intArg(args, "height") != null ? intArg(args, "height") : spec.height;

        // Enrich the query so we don't end up with random "Tunisia" tourism shots
        String enriched = enrichQuery(rawQuery, context);

        java.util.List<Map<String, Object>> results = new java.util.ArrayList<>();
        String sourceUsed = "none";

        // 1. Pexels (preferred when key set — bigger free tier than Unsplash)
        String pexelsKey = aiSettings.resolvePexelsKey();
        if (pexelsKey != null) {
            results.addAll(fetchPexels(enriched, count, width, height, spec.orientation, pexelsKey));
            if (!results.isEmpty()) sourceUsed = "pexels";
        }

        // 2. Unsplash (if admin configured an Access Key) — curated hero-quality photos
        if (results.size() < count) {
            String unsplashKey = aiSettings.resolveUnsplashKey();
            if (unsplashKey != null) {
                int before = results.size();
                results.addAll(fetchUnsplash(enriched, count - before, width, height, spec.orientation, unsplashKey));
                if (results.size() > before && "none".equals(sourceUsed)) sourceUsed = "unsplash";
            }
        }

        // 3. OpenVerse fallback
        if (results.size() < count) {
            int before = results.size();
            results.addAll(fetchOpenVerse(enriched, count - before, width, height, spec.aspectRatio));
            if (results.size() > before && "none".equals(sourceUsed)) sourceUsed = "openverse";
        }

        // 3. Top up with Picsum (always reachable, never topical — placeholder).
        // No HEAD check: Picsum is rock-solid, and HEAD checks add 5s of latency.
        if (results.size() < count) {
            log.info("Topping up {} → {} with Picsum placeholders for '{}'", results.size(), count, enriched);
            String encoded = java.net.URLEncoder.encode(enriched, java.nio.charset.StandardCharsets.UTF_8);
            for (int i = results.size(); i < count; i++) {
                String seed = encoded + "-" + (i + 1);
                String url  = "https://picsum.photos/seed/" + seed + "/" + width + "/" + height;
                results.add(java.util.Map.of(
                    "url", url,
                    "credit", "Lorem Picsum (placeholder)",
                    "query", enriched,
                    "size", width + "x" + height,
                    "verified", true,
                    "topical", false
                ));
            }
            if ("none".equals(sourceUsed)) sourceUsed = "picsum";
            else sourceUsed = sourceUsed + "+picsum";
        }

        return Map.of(
            "query", enriched,
            "originalQuery", rawQuery,
            "context", context,
            "source", sourceUsed,
            "count", results.size(),
            "items", results,
            "hint", "CRITICAL: When you build a patch (update_landing_page, update_programme, partner.logoUrl), " +
                    "copy the `url` field from items[] VERBATIM. Do NOT construct your own image URLs. " +
                    "Do NOT invent `source.unsplash.com` URLs — that endpoint was shut down and ALL such URLs are dead. " +
                    "`features` is an ARRAY of objects: features[i].imageUrl, not feature1ImageUrl/feature2ImageUrl. " +
                    "If the photos don't feel right, call search_photos again with a more specific English query " +
                    "(e.g. 'modern coworking space office' instead of just 'office')."
        );
    }

    // ── Photo source helpers ─────────────────────────────────────────────────

    private record ContextSpec(int width, int height, String aspectRatio, String orientation) {}

    /** Per-context defaults for size + aspect filter. */
    private static ContextSpec contextSpec(String context) {
        return switch (context) {
            case "hero"          -> new ContextSpec(1920, 800,  "wide",    "landscape");
            case "feature"       -> new ContextSpec(800,  600,  "wide",    "landscape");
            case "partner_logo", "logo" -> new ContextSpec(400, 400, "square", "squarish");
            case "team", "portrait"     -> new ContextSpec(600, 800, "tall",   "portrait");
            case "abstract"      -> new ContextSpec(1600, 1000, "wide",   "landscape");
            default              -> new ContextSpec(1600, 900,  "wide",    "landscape");
        };
    }

    /**
     * Make raw queries more topical. The AI tends to send short queries like "tunisia"
     * which hit random tourism shots. We append context-aware adjectives so the photo
     * source returns startup/business-relevant images.
     */
    private static String enrichQuery(String query, String context) {
        String q = (query == null ? "" : query.trim().toLowerCase());
        if (q.isEmpty()) q = "incubator";

        // If the admin/AI already wrote a rich query (3+ words), keep it
        long words = java.util.Arrays.stream(q.split("\\s+")).filter(w -> !w.isBlank()).count();
        if (words >= 3) return q;

        String suffix = switch (context) {
            case "hero"          -> "modern professional business technology";
            case "feature"       -> "clean minimal workspace";
            case "partner_logo", "logo" -> "logo brand";
            case "team", "portrait"     -> "diverse smiling professional";
            case "abstract"      -> "abstract gradient modern";
            default              -> "professional modern";
        };
        return q + " " + suffix;
    }

    /**
     * Hit Pexels search API. Requires a free API key (200 req/hr, 20K/month).
     * https://www.pexels.com/api/
     *
     * Pexels' response includes multiple sizes per photo. We pick the one closest
     * to the requested width to keep payloads light.
     */
    @SuppressWarnings("unchecked")
    private java.util.List<Map<String, Object>> fetchPexels(String query, int count, int width, int height,
                                                            String orientation, String apiKey) {
        java.util.List<Map<String, Object>> out = new java.util.ArrayList<>();
        try {
            // Map our orientation to Pexels' (landscape | portrait | square)
            String pexOrient = switch (orientation == null ? "landscape" : orientation) {
                case "portrait"  -> "portrait";
                case "squarish"  -> "square";
                default          -> "landscape";
            };
            String url = "https://api.pexels.com/v1/search"
                    + "?query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&per_page=" + Math.min(80, Math.max(count + 2, 10))
                    + "&orientation=" + pexOrient;
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(8))
                    .header("Accept", "application/json")
                    .header("Authorization", apiKey)  // Pexels uses raw key, NOT "Bearer ..."
                    .GET()
                    .build();
            java.net.http.HttpResponse<String> resp = photoClient.send(req,
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 401 || resp.statusCode() == 403) {
                log.warn("Pexels auth failed ({}) — check the API key", resp.statusCode());
                return out;
            }
            if (resp.statusCode() == 429) {
                log.warn("Pexels rate-limited; falling back to next source");
                return out;
            }
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("Pexels {} for '{}': {}", resp.statusCode(), query, resp.body());
                return out;
            }
            Map<String, Object> body = json.readValue(resp.body(), Map.class);
            java.util.List<Map<String, Object>> photos = (java.util.List<Map<String, Object>>) body.get("photos");
            if (photos == null || photos.isEmpty()) return out;

            String size = width + "x" + height;
            for (Map<String, Object> p : photos) {
                if (out.size() >= count) break;
                Map<String, Object> src = (Map<String, Object>) p.get("src");
                if (src == null) continue;
                // Pick the size closest to requested width
                String imgUrl = pickPexelsSize(src, width);
                if (imgUrl == null) continue;
                String thumb = String.valueOf(src.getOrDefault("medium", src.get("small")));
                String photographer = String.valueOf(p.getOrDefault("photographer", "Pexels"));
                String pexelsPage  = String.valueOf(p.getOrDefault("url", ""));
                String alt         = String.valueOf(p.getOrDefault("alt", query));

                out.add(java.util.Map.of(
                    "url", imgUrl,
                    "thumbnail", thumb,
                    "credit", photographer + " · Pexels",
                    "creditUrl", pexelsPage,
                    "title", alt,
                    "query", query,
                    "size", size,
                    "verified", true,
                    "topical", true
                ));
            }
            log.info("Pexels '{}' → {} items returned", query, out.size());
        } catch (Exception e) {
            log.warn("Pexels fetch failed for '{}': {}", query, e.getMessage());
        }
        return out;
    }

    /** Pick the Pexels image size closest to (and ≥) the requested width. */
    private static String pickPexelsSize(Map<String, Object> src, int targetWidth) {
        // Pexels widths: original (full), large2x (~1880), large (~940), medium (~350), small (~130)
        String[] preferenceOrder = targetWidth >= 1500 ? new String[]{"large2x","original","large","medium"}
                                  : targetWidth >= 800  ? new String[]{"large","large2x","medium","original"}
                                  : targetWidth >= 400  ? new String[]{"medium","large","small","large2x"}
                                                        : new String[]{"small","medium","large"};
        for (String k : preferenceOrder) {
            Object v = src.get(k);
            if (v != null && !"null".equals(String.valueOf(v))) return String.valueOf(v);
        }
        return null;
    }

    /**
     * Hit Unsplash search API. Requires a free Access Key (50 req/hr).
     * Returns curated, high-quality images with proper attribution.
     */
    @SuppressWarnings("unchecked")
    private java.util.List<Map<String, Object>> fetchUnsplash(String query, int count, int width, int height,
                                                              String orientation, String accessKey) {
        java.util.List<Map<String, Object>> out = new java.util.ArrayList<>();
        try {
            String url = "https://api.unsplash.com/search/photos"
                    + "?query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&per_page=" + Math.min(30, count)
                    + "&orientation=" + orientation
                    + "&content_filter=high";
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(8))
                    .header("Accept", "application/json")
                    .header("Accept-Version", "v1")
                    .header("Authorization", "Client-ID " + accessKey)
                    .GET()
                    .build();
            java.net.http.HttpResponse<String> resp = photoClient.send(req,
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 401 || resp.statusCode() == 403) {
                log.warn("Unsplash auth failed ({}) — check the Access Key in settings", resp.statusCode());
                return out;
            }
            if (resp.statusCode() == 429) {
                log.warn("Unsplash rate-limited (50/hr free tier); falling back to OpenVerse");
                return out;
            }
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("Unsplash {} for '{}': {}", resp.statusCode(), query, resp.body());
                return out;
            }
            Map<String, Object> body = json.readValue(resp.body(), Map.class);
            java.util.List<Map<String, Object>> items = (java.util.List<Map<String, Object>>) body.get("results");
            if (items == null || items.isEmpty()) return out;

            String size = width + "x" + height;
            for (Map<String, Object> it : items) {
                if (out.size() >= count) break;
                Map<String, Object> urls = (Map<String, Object>) it.get("urls");
                if (urls == null) continue;
                // Use the regular URL and append our own w= param for sizing
                String imgUrl = String.valueOf(urls.getOrDefault("regular", urls.get("full")));
                if (imgUrl == null || "null".equals(imgUrl)) continue;
                if (!imgUrl.contains("w=")) imgUrl = imgUrl + (imgUrl.contains("?") ? "&" : "?") + "w=" + width + "&q=80";

                Map<String, Object> user = (Map<String, Object>) it.get("user");
                String creator = user != null ? String.valueOf(user.getOrDefault("name", "Unsplash")) : "Unsplash";
                String thumb   = String.valueOf(urls.getOrDefault("small", imgUrl));
                String desc    = String.valueOf(it.getOrDefault("alt_description", it.getOrDefault("description", query)));

                out.add(java.util.Map.of(
                    "url", imgUrl,
                    "thumbnail", thumb,
                    "credit", creator + " · Unsplash",
                    "title", desc,
                    "query", query,
                    "size", size,
                    "verified", true,
                    "topical", true
                ));
            }
        } catch (Exception e) {
            log.warn("Unsplash fetch failed for '{}': {}", query, e.getMessage());
        }
        return out;
    }

    /** Hit OpenVerse (https://api.openverse.org) — CC-licensed image search, no auth required. */
    @SuppressWarnings("unchecked")
    private java.util.List<Map<String, Object>> fetchOpenVerse(String query, int count, int width, int height, String aspectRatio) {
        java.util.List<Map<String, Object>> out = new java.util.ArrayList<>();
        try {
            // Loosened filters: license_type=commercial and source whitelist were dropping
            // 90%+ of results. mature=false is the only safety filter we keep.
            String url = "https://api.openverse.org/v1/images/?q="
                    + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&page_size=" + Math.min(20, Math.max(count * 2, count + 4))
                    + "&mature=false"
                    + (aspectRatio != null ? "&aspect_ratio=" + aspectRatio : "");
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(8))
                    .header("Accept", "application/json")
                    .header("User-Agent", "Medianet-Incubateur/1.0 (admin-ai)")
                    .GET()
                    .build();
            java.net.http.HttpResponse<String> resp = photoClient.send(req,
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("OpenVerse {} for '{}': {}", resp.statusCode(), query, resp.body());
                return out;
            }
            Map<String, Object> body = json.readValue(resp.body(), Map.class);
            java.util.List<Map<String, Object>> items = (java.util.List<Map<String, Object>>) body.get("results");
            if (items == null) return out;

            String size = width + "x" + height;
            for (Map<String, Object> it : items) {
                if (out.size() >= count) break;
                String imgUrl = (String) it.get("url");
                if (imgUrl == null || imgUrl.isBlank()) continue;
                // Don't HEAD-check — Flickr/Wikimedia often return 302→200 chains that
                // HEAD probes mishandle. Trust the source curation.
                String creator = String.valueOf(it.getOrDefault("creator", "Inconnu"));
                String title   = String.valueOf(it.getOrDefault("title", query));
                String license = String.valueOf(it.getOrDefault("license", "cc"));
                out.add(java.util.Map.of(
                    "url", imgUrl,
                    "thumbnail", String.valueOf(it.getOrDefault("thumbnail", imgUrl)),
                    "credit", creator + " · OpenVerse (" + license.toUpperCase() + ")",
                    "title", title,
                    "query", query,
                    "size", size,
                    "verified", true
                ));
            }
            log.info("OpenVerse '{}' → {} items returned", query, out.size());
        } catch (Exception e) {
            log.warn("OpenVerse fetch failed for '{}': {}", query, e.getMessage());
        }
        return out;
    }

    /**
     * Some LLMs serialize nested object/array arguments as JSON strings rather
     * than as real objects/arrays. We re-parse ANY string value that looks like
     * JSON (starts with `{` or `[`). Covers patch/body/data/sectors/roles/etc.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> normalizeStringifiedObjects(Map<String, Object> args) {
        if (args == null || args.isEmpty()) return args;
        Map<String, Object> out = new java.util.LinkedHashMap<>(args);
        for (Map.Entry<String, Object> e : args.entrySet()) {
            Object v = e.getValue();
            if (!(v instanceof String s) || s.isBlank()) continue;
            String trimmed = s.trim();
            boolean looksLikeJson = (trimmed.startsWith("{") && trimmed.endsWith("}"))
                                 || (trimmed.startsWith("[") && trimmed.endsWith("]"));
            if (!looksLikeJson) continue;
            try {
                out.put(e.getKey(), json.readValue(trimmed, Object.class));
                continue;
            } catch (Exception ignored) {}
            // Fallback: Python-style single quotes
            try {
                out.put(e.getKey(), json.readValue(trimmed.replace("'", "\""), Object.class));
            } catch (Exception ignored) {}
        }
        return out;
    }

    /**
     * Public entry point used by the agent loop to pre-validate args BEFORE saving
     * a write tool as a pending action. Throws with a French error if anything is
     * wrong so the AI can self-correct in the same turn.
     */
    public void validateWriteArgs(String tool, Map<String, Object> args) {
        Map<String, Object> normalized = normalizeStringifiedObjects(args);
        validateNoDeadImageUrls(normalized);
    }

    /**
     * Walks the arg tree and rejects any string that points to a known-dead photo source.
     * Currently flags {@code source.unsplash.com} — that endpoint was sunset by Unsplash
     * in 2024 and ALL such URLs return 503 / 404. The LLM keeps regenerating them from
     * training data, so we have to bounce them here.
     */
    private static final java.util.regex.Pattern DEAD_IMG = java.util.regex.Pattern.compile(
        "(?i)https?://source\\.unsplash\\.com/\\S+");

    private void validateNoDeadImageUrls(Object node) {
        if (node == null) return;
        if (node instanceof String s) {
            if (DEAD_IMG.matcher(s).find()) {
                throw new IllegalArgumentException(
                    "URL d'image refusée : « " + s + " ». L'endpoint source.unsplash.com a été supprimé par Unsplash. " +
                    "Appelle d'abord search_photos(query=\"...\") puis recopie le champ `url` du résultat VERBATIM.");
            }
            return;
        }
        if (node instanceof java.util.Map<?, ?> map) {
            for (Object v : map.values()) validateNoDeadImageUrls(v);
            return;
        }
        if (node instanceof java.util.Collection<?> col) {
            for (Object v : col) validateNoDeadImageUrls(v);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseArgs(String s) {
        if (s == null || s.isBlank()) return null;
        try { return json.readValue(s, Map.class); } catch (Exception e) { return null; }
    }

    private String stringify(Object o) {
        try { return json.writeValueAsString(o); } catch (Exception e) { return null; }
    }

    private static Integer intArg(Map<String, Object> args, String key) {
        Object v = args.get(key);
        if (v == null) return null;
        if (v instanceof Integer i) return i;
        if (v instanceof Long l) return l.intValue();
        if (v instanceof Number n) return n.intValue();
        return Integer.valueOf(v.toString());
    }

    private static Long longArg(Map<String, Object> args, String key) {
        Object v = args.get(key);
        if (v == null) return null;
        if (v instanceof Long l) return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Number n) return n.longValue();
        return Long.valueOf(v.toString());
    }

    private static Long longOf(Object v) {
        if (v == null) return null;
        if (v instanceof Long l) return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Number n) return n.longValue();
        try { return Long.valueOf(v.toString()); } catch (Exception e) { return null; }
    }
}
