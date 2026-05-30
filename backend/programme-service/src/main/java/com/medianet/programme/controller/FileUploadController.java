package com.medianet.programme.controller;

import com.medianet.programme.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * File upload endpoints (admin-only). Stores files in MinIO and returns
 * the public URL the frontend can drop into <code>logoUrl</code>,
 * <code>bannerImageUrl</code>, etc.
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileStorageService storage;

    /**
     * Upload an image (PNG / JPG / WebP / SVG / GIF).
     * <p>Usage: <code>POST /api/files/upload?folder=logos</code> with multipart field <code>file</code>.
     * Returns: <code>{ "url": "http://localhost:9000/medianet/logos/2026-05-22/abc.png" }</code>
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "uploads") String folder) {
        String url = storage.upload(folder, file, /* onlyImages */ true);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /** Upload a non-image file (PDF, pitch deck, etc.) — ADMIN only. */
    @PostMapping(value = "/upload-any", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> uploadAny(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "documents") String folder) {
        String url = storage.upload(folder, file, /* onlyImages */ false);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /** Delete an uploaded file by its public URL — ADMIN only. */
    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@RequestParam String url) {
        storage.deleteByUrl(url);
        return ResponseEntity.noContent().build();
    }
}
