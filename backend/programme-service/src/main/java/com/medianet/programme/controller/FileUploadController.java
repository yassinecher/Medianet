package com.medianet.programme.controller;

import com.medianet.programme.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * File upload endpoints. Stores files in MinIO and returns
 * the public URL the frontend can drop into <code>logoUrl</code>,
 * <code>bannerImageUrl</code>, etc.
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileStorageService storage;

    /**
     * Upload an image (PNG / JPG / WebP / GIF, plus SVG for staff).
     * <p>Usage: <code>POST /api/files/upload?folder=logos</code> with multipart field <code>file</code>.
     * Returns: <code>{ "url": "http://localhost:9000/medianet/logos/2026-05-22/abc.png" }</code>
     *
     * <p>Any signed-in user: porteurs upload their organisation logo and avatar
     * from the front-office (/upload-doc already accepts any file from them).
     * SVG can carry scripts, so it stays reserved to staff.
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "uploads") String folder) {
        if ("image/svg+xml".equals(file.getContentType()) && !isStaff()) {
            throw new IllegalArgumentException("Les images SVG ne sont pas acceptées ici : utilisez un PNG, JPG ou WebP.");
        }
        String url = storage.upload(folder, file, /* onlyImages */ true);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * Import an image from a link — body <code>{ "url": "…", "folder": "logos" }</code>.
     * The server downloads it (Google Drive / Dropbox / GitHub share links are
     * understood) and stores a copy, so the site keeps working even if the
     * original link changes. Returns <code>{ "url": … }</code>, like /upload.
     * 400 = not usable (not an image, internal address…); 422 = the remote site
     * refused us (the browser may still be able to show the link directly).
     */
    @PostMapping("/import")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> importFromLink(@RequestBody Map<String, String> body) {
        String folder = body.getOrDefault("folder", "uploads");
        String url = storage.importFromUrl(folder, body.get("url"), isStaff());
        return ResponseEntity.ok(Map.of("url", url));
    }

    private static boolean isStaff() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("programmes:update"));
    }

    /** Upload a non-image file (PDF, pitch deck, etc.) — ADMIN only. */
    @PostMapping(value = "/upload-any", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Map<String, String>> uploadAny(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "documents") String folder) {
        String url = storage.upload(folder, file, /* onlyImages */ false);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * Upload a task deliverable document (PDF, deck, image, archive…) — ANY
     * authenticated user, so porteurs can submit their task "rendus". Non-image
     * files allowed. Returns { url, filename }.
     */
    @PostMapping(value = "/upload-doc", consumes = "multipart/form-data")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> uploadDoc(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "task-docs") String folder) {
        String url = storage.upload(folder, file, /* onlyImages */ false);
        return ResponseEntity.ok(Map.of("url", url,
                "filename", file.getOriginalFilename() != null ? file.getOriginalFilename() : "document"));
    }

    /**
     * Upload a pitch video — any authenticated user (porteurs upload their own
     * presentation). Video content types, up to 250 MB. Returns { url, filename }.
     */
    @PostMapping(value = "/upload-video", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadVideo(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "pitch-videos") String folder) {
        String url = storage.uploadVideo(folder, file);
        return ResponseEntity.ok(Map.of("url", url, "filename",
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "pitch"));
    }

    /** Delete an uploaded file by its public URL — ADMIN only. */
    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> delete(@RequestParam String url) {
        storage.deleteByUrl(url);
        return ResponseEntity.noContent().build();
    }
}
