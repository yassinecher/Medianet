package com.medianet.programme.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medianet.programme.dto.LandingBlock;
import com.medianet.programme.dto.LandingDraftDto;
import com.medianet.programme.dto.LandingPageDto;
import com.medianet.programme.entity.LandingPage;
import com.medianet.programme.repository.LandingPageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Landing page CMS: a published page (what visitors see) and an optional draft
 * (the admin's working copy), both made of typed blocks + site settings.
 *
 * <ul>
 *   <li>The public page is served from an in-memory copy, refreshed on every
 *       write; its {@code version} feeds the HTTP ETag, so unchanged pages cost
 *       a 304 and no database access.</li>
 *   <li>The editor autosaves to the draft; "Publier" promotes it.</li>
 *   <li>{@link #patchPublished} keeps the flat legacy patch format working for
 *       the admin AI agent ({@code update_landing_page}) and its undo.</li>
 * </ul>
 */
@Service
@Slf4j
public class LandingPageService {

    private static final Long SINGLETON_ID = 1L;
    private static final int MAX_JSON = 1_000_000;

    private final LandingPageRepository repository;
    private final LandingBlocks blocks;
    private final LegacyLandingMigration legacy;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    private final TransactionTemplate readTx;

    /** Published page as served to visitors; replaced (never mutated) on write. */
    private volatile LandingPageDto publishedCache;
    /** Set once the singleton row exists with blocks (created or migrated). */
    private volatile boolean initialized;

    public LandingPageService(LandingPageRepository repository, LandingBlocks blocks,
                              LegacyLandingMigration legacy, ObjectMapper mapper,
                              PlatformTransactionManager txManager) {
        this.repository = repository;
        this.blocks = blocks;
        this.legacy = legacy;
        this.mapper = mapper;
        this.tx = new TransactionTemplate(txManager);
        this.readTx = new TransactionTemplate(txManager);
        this.readTx.setReadOnly(true);
    }

    // ── Public ───────────────────────────────────────────────────────────────

    public LandingPageDto getPublished() {
        LandingPageDto cached = publishedCache;
        if (cached != null) return cached;
        ensureInitialized();
        LandingPageDto dto = readTx.execute(s -> published(load()));
        cache(dto);
        return dto;
    }

    // ── Editor (draft / publish) ─────────────────────────────────────────────

    public LandingDraftDto getDraft() {
        ensureInitialized();
        return readTx.execute(s -> draftView(load()));
    }

    /** Autosave: replace the draft with {@code doc} (blocks + settings). */
    public LandingDraftDto saveDraft(LandingPageDto doc) {
        LandingPageDto clean = clean(doc);
        ensureInitialized();
        return tx.execute(s -> {
            LandingPage p = load();
            p.setDraftJson(json(clean));
            p.setDraftUpdatedAt(LocalDateTime.now());
            return draftView(repository.save(p));
        });
    }

    /** Publish {@code doc} if given, else the stored draft (no draft → no-op). */
    public LandingPageDto publish(LandingPageDto doc) {
        LandingPageDto clean = doc == null ? null : clean(doc);
        ensureInitialized();
        LandingPageDto published = tx.execute(s -> {
            LandingPage p = load();
            LandingPageDto source = clean != null ? clean
                    : p.getDraftJson() != null ? parse(p.getDraftJson()) : null;
            if (source != null) writePublished(p, source);
            p.setDraftJson(null);
            p.setDraftUpdatedAt(null);
            return published(repository.save(p));
        });
        cache(published);
        return published;
    }

    /** Drop the draft; the editor falls back to the published page. */
    public LandingDraftDto discardDraft() {
        ensureInitialized();
        return tx.execute(s -> {
            LandingPage p = load();
            p.setDraftJson(null);
            p.setDraftUpdatedAt(null);
            return draftView(repository.save(p));
        });
    }

    /** Replace the draft's blocks with the default content (logo, colors and footer kept). */
    public LandingDraftDto resetDraft() {
        ensureInitialized();
        return tx.execute(s -> {
            LandingPage p = load();
            LandingPageDto base = p.getDraftJson() != null ? parse(p.getDraftJson()) : published(p);
            base.setBlocks(blocks.defaults());
            p.setDraftJson(json(clean(base)));
            p.setDraftUpdatedAt(LocalDateTime.now());
            return draftView(repository.save(p));
        });
    }

    /**
     * Direct update of the PUBLISHED page from a partial document: {@code blocks},
     * site settings and/or legacy flat fields ({@code heroTitle}, {@code stats}, …).
     * Used by the admin AI agent. When a draft exists the same settings/legacy
     * changes are applied to it too, so publishing it later doesn't undo them.
     */
    public LandingPageDto patchPublished(Map<String, Object> patch) {
        ensureInitialized();
        LandingPageDto published = tx.execute(s -> {
            LandingPage p = load();
            writePublished(p, applyPatch(published(p), patch, true));
            if (p.getDraftJson() != null) {
                p.setDraftJson(json(applyPatch(parse(p.getDraftJson()), patch, false)));
            }
            return published(repository.save(p));
        });
        cache(published);
        return published;
    }

    // ── Internals ────────────────────────────────────────────────────────────

    /**
     * Create (fresh install) or migrate (pre-blocks database) the singleton row,
     * once per process. The legacy read runs OUTSIDE any transaction: on
     * PostgreSQL a failing query (e.g. an old table that doesn't exist) would
     * otherwise abort the surrounding transaction.
     */
    private void ensureInitialized() {
        if (initialized) return;
        synchronized (this) {
            if (initialized) return;
            LandingPage existing = repository.findById(SINGLETON_ID).orElse(null);
            if (existing == null || existing.getBlocksJson() == null) {
                Map<String, Object> old = existing == null ? null : legacy.read();
                List<LandingBlock> initial = blocks.sanitize(old != null ? blocks.fromLegacy(old) : blocks.defaults());
                tx.executeWithoutResult(s -> {
                    LandingPage p = repository.findById(SINGLETON_ID)
                            .orElseGet(() -> LandingPage.builder().id(SINGLETON_ID).build());
                    if (p.getBlocksJson() != null) return; // another instance won the race
                    p.setBlocksJson(json(initial));
                    if (p.getSiteThemeMode() == null) p.setSiteThemeMode("default");
                    if (p.getFooterText() == null) p.setFooterText("© 2026 Medianet Incubateur. Tous droits réservés.");
                    p.setContentVersion(p.getContentVersion() == null ? 1L : p.getContentVersion() + 1);
                    p.setPublishedAt(LocalDateTime.now());
                    repository.save(p);
                });
                log.info("Landing page initialized with {} blocks ({})", initial.size(),
                        old != null ? "migrated from the legacy sections" : "default content");
            }
            initialized = true;
        }
    }

    /** The singleton row (always present after {@link #ensureInitialized()}). */
    private LandingPage load() {
        return repository.findById(SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("landing_page row missing"));
    }

    private LandingPageDto published(LandingPage p) {
        return LandingPageDto.builder()
                .blocks(parseBlocks(p.getBlocksJson()))
                .logoUrl(p.getLogoUrl())
                .primaryColor(p.getPrimaryColor())
                .accentColor(p.getAccentColor())
                .siteThemeMode(p.getSiteThemeMode() == null ? "default" : p.getSiteThemeMode())
                .sitePrimaryColor(p.getSitePrimaryColor())
                .siteAccentColor(p.getSiteAccentColor())
                .footerText(p.getFooterText())
                .version(p.getContentVersion() == null ? 0L : p.getContentVersion())
                .publishedAt(p.getPublishedAt())
                .build();
    }

    private LandingDraftDto draftView(LandingPage p) {
        boolean hasDraft = p.getDraftJson() != null;
        return LandingDraftDto.builder()
                .page(hasDraft ? parse(p.getDraftJson()) : published(p))
                .hasDraft(hasDraft)
                .draftUpdatedAt(p.getDraftUpdatedAt())
                .publishedAt(p.getPublishedAt())
                .build();
    }

    private void writePublished(LandingPage p, LandingPageDto doc) {
        p.setBlocksJson(json(doc.getBlocks()));
        p.setLogoUrl(doc.getLogoUrl());
        p.setPrimaryColor(doc.getPrimaryColor());
        p.setAccentColor(doc.getAccentColor());
        p.setSiteThemeMode(doc.getSiteThemeMode());
        p.setSitePrimaryColor(doc.getSitePrimaryColor());
        p.setSiteAccentColor(doc.getSiteAccentColor());
        p.setFooterText(doc.getFooterText());
        p.setContentVersion(p.getContentVersion() == null ? 1L : p.getContentVersion() + 1);
        p.setPublishedAt(LocalDateTime.now());
    }

    /** Validate + normalize a full document coming from the editor. */
    private LandingPageDto clean(LandingPageDto doc) {
        LandingPageDto out = LandingPageDto.builder()
                .blocks(blocks.sanitize(doc.getBlocks()))
                .logoUrl(blocks.cleanUrl(doc.getLogoUrl()))
                .primaryColor(blocks.cleanColor(doc.getPrimaryColor()))
                .accentColor(blocks.cleanColor(doc.getAccentColor()))
                .siteThemeMode(blocks.cleanThemeMode(doc.getSiteThemeMode()))
                .sitePrimaryColor(blocks.cleanColor(doc.getSitePrimaryColor()))
                .siteAccentColor(blocks.cleanColor(doc.getSiteAccentColor()))
                .footerText(blank(doc.getFooterText()))
                .build();
        if (json(out).length() > MAX_JSON) {
            throw new IllegalArgumentException("La page est trop volumineuse (limite ~1 Mo).");
        }
        return out;
    }

    /** Apply a partial document (blocks / settings / legacy flat fields) to {@code doc}. */
    private LandingPageDto applyPatch(LandingPageDto doc, Map<String, Object> patch, boolean allowBlocks) {
        if (allowBlocks && patch.get("blocks") instanceof List<?> list) {
            doc.setBlocks(mapper.convertValue(list, new TypeReference<List<LandingBlock>>() {}));
        }
        setIfPresent(patch, "logoUrl", doc::setLogoUrl);
        setIfPresent(patch, "primaryColor", doc::setPrimaryColor);
        setIfPresent(patch, "accentColor", doc::setAccentColor);
        setIfPresent(patch, "siteThemeMode", doc::setSiteThemeMode);
        setIfPresent(patch, "sitePrimaryColor", doc::setSitePrimaryColor);
        setIfPresent(patch, "siteAccentColor", doc::setSiteAccentColor);
        setIfPresent(patch, "footerText", doc::setFooterText);
        if (blocks.hasLegacyFields(patch)) {
            List<LandingBlock> list = new ArrayList<>(doc.getBlocks() == null ? List.of() : doc.getBlocks());
            blocks.applyLegacyPatch(list, patch);
            doc.setBlocks(list);
        }
        return clean(doc);
    }

    private static void setIfPresent(Map<String, Object> patch, String key, Consumer<String> setter) {
        if (patch.containsKey(key)) setter.accept(patch.get(key) == null ? null : String.valueOf(patch.get(key)));
    }

    private static String blank(String v) {
        return v == null || v.isBlank() ? null : v;
    }

    /** Keep the newest published copy in memory (a slower concurrent reader can't regress it). */
    private synchronized void cache(LandingPageDto dto) {
        LandingPageDto current = publishedCache;
        if (current == null || dto.getVersion() >= current.getVersion()) publishedCache = dto;
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Contenu de page invalide", e);
        }
    }

    private LandingPageDto parse(String json) {
        try {
            LandingPageDto d = mapper.readValue(json, LandingPageDto.class);
            if (d.getBlocks() == null) d.setBlocks(new ArrayList<>());
            return d;
        } catch (Exception e) {
            log.warn("Unreadable landing draft, ignoring it: {}", e.getMessage());
            return LandingPageDto.builder().blocks(blocks.defaults()).build();
        }
    }

    private List<LandingBlock> parseBlocks(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<LandingBlock>>() {});
        } catch (Exception e) {
            log.warn("Unreadable landing blocks, serving defaults: {}", e.getMessage());
            return blocks.defaults();
        }
    }
}
