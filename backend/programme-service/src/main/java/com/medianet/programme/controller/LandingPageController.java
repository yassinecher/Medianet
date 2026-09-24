package com.medianet.programme.controller;

import com.medianet.programme.dto.LandingDraftDto;
import com.medianet.programme.dto.LandingPageDto;
import com.medianet.programme.service.LandingPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Landing page CMS.
 *
 * <pre>
 *   GET    /api/landing-page          public — published page (ETag / 304)
 *   GET    /api/landing-page/draft    editor — working copy + hasDraft
 *   PUT    /api/landing-page/draft    editor autosave
 *   DELETE /api/landing-page/draft    discard unpublished changes
 *   POST   /api/landing-page/publish  publish the given document (or the stored draft)
 *   POST   /api/landing-page/reset    default blocks into the draft
 *   PUT    /api/landing-page          partial update of the published page
 *                                     (admin AI agent: blocks, settings or legacy flat fields)
 * </pre>
 */
@RestController
@RequestMapping("/api/landing-page")
@RequiredArgsConstructor
public class LandingPageController {

    private static final String CAN_READ  = "hasRole('ADMIN') or hasAuthority('landing:read')";
    private static final String CAN_WRITE = "hasRole('ADMIN') or hasAuthority('landing:update')";

    private final LandingPageService service;

    /**
     * Public. Revalidated on every load (no-cache) but answered with 304 while the
     * published version is unchanged, so the logo/theme/landing fetch done on every
     * front-office page costs almost nothing.
     */
    @GetMapping
    public ResponseEntity<LandingPageDto> get(
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        LandingPageDto page = service.getPublished();
        String etag = "\"lp-" + page.getVersion() + "\"";
        if (matches(ifNoneMatch, etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(CacheControl.noCache()).build();
        }
        return ResponseEntity.ok().eTag(etag).cacheControl(CacheControl.noCache()).body(page);
    }

    /** If-None-Match may list several tags and a proxy (nginx gzip) may have weakened ours to W/"…". */
    private static boolean matches(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null) return false;
        for (String tag : ifNoneMatch.split(",")) {
            if (tag.trim().replaceFirst("^W/", "").equals(etag)) return true;
        }
        return false;
    }

    @GetMapping("/draft")
    @PreAuthorize(CAN_READ)
    public ResponseEntity<LandingDraftDto> draft() {
        return ResponseEntity.ok(service.getDraft());
    }

    @PutMapping("/draft")
    @PreAuthorize(CAN_WRITE)
    public ResponseEntity<LandingDraftDto> saveDraft(@RequestBody LandingPageDto doc) {
        return ResponseEntity.ok(service.saveDraft(doc));
    }

    @DeleteMapping("/draft")
    @PreAuthorize(CAN_WRITE)
    public ResponseEntity<LandingDraftDto> discardDraft() {
        return ResponseEntity.ok(service.discardDraft());
    }

    @PostMapping("/publish")
    @PreAuthorize(CAN_WRITE)
    public ResponseEntity<LandingPageDto> publish(@RequestBody(required = false) LandingPageDto doc) {
        return ResponseEntity.ok(service.publish(doc));
    }

    @PostMapping("/reset")
    @PreAuthorize(CAN_WRITE)
    public ResponseEntity<LandingDraftDto> reset() {
        return ResponseEntity.ok(service.resetDraft());
    }

    @PutMapping
    @PreAuthorize(CAN_WRITE)
    public ResponseEntity<LandingPageDto> patch(@RequestBody Map<String, Object> patch) {
        return ResponseEntity.ok(service.patchPublished(patch));
    }
}
