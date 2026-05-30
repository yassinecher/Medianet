package com.medianet.programme.storage;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.SetBucketPolicyArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Uploads photos / documents to MinIO and returns a public URL.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileStorageService {

    private final MinioClient client;
    private final MinioConfig config;

    private static final Set<String> ALLOWED_IMAGES = Set.of("image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif");
    private static final long        MAX_BYTES      = 10 * 1024 * 1024L; // 10 MB

    @PostConstruct
    void ensureBucket() {
        try {
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(config.getBucket()).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(config.getBucket()).build());
                log.info("Created MinIO bucket {}", config.getBucket());
            }
            // Public read policy so browsers can fetch logos/banners without signing
            String publicPolicy = """
                {
                  "Version": "2012-10-17",
                  "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::%s/*"]
                  }]
                }
                """.formatted(config.getBucket());
            client.setBucketPolicy(SetBucketPolicyArgs.builder()
                    .bucket(config.getBucket())
                    .config(publicPolicy)
                    .build());
        } catch (Exception e) {
            // Don't crash the service on startup if MinIO is briefly unavailable;
            // the next upload will retry.
            log.warn("MinIO init warning: {}", e.getMessage());
        }
    }

    /**
     * Upload a file under a logical folder and return the public URL.
     *
     * @param folder logical sub-directory ("logos", "banners", "avatars", "partners"…)
     * @param file   the multipart payload
     * @param onlyImages if true, reject non-image content types
     */
    public String upload(String folder, MultipartFile file, boolean onlyImages) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File too large (max 10 MB)");
        }
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        if (onlyImages && !ALLOWED_IMAGES.contains(contentType)) {
            throw new IllegalArgumentException("Only image files are allowed: " + ALLOWED_IMAGES);
        }

        String safeFolder = (folder == null || folder.isBlank()) ? "uploads" : folder.replaceAll("[^a-zA-Z0-9_-]", "_");
        String ext        = extractExtension(file.getOriginalFilename(), contentType);
        String objectKey  = "%s/%s/%s%s".formatted(safeFolder, LocalDate.now(), UUID.randomUUID(), ext);

        try (InputStream is = file.getInputStream()) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(config.getBucket())
                    .object(objectKey)
                    .stream(is, file.getSize(), -1)
                    .contentType(contentType)
                    .build());
            String url = "%s/%s/%s".formatted(stripTrailingSlash(config.getPublicUrl()), config.getBucket(), objectKey);
            log.info("Uploaded {} ({} bytes) -> {}", objectKey, file.getSize(), url);
            return url;
        } catch (Exception e) {
            log.error("Upload failed", e);
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }

    /** Delete an object given its full public URL (best-effort — silently ignores misses). */
    public void deleteByUrl(String publicUrl) {
        if (publicUrl == null || !publicUrl.contains(config.getBucket() + "/")) return;
        String objectKey = publicUrl.substring(publicUrl.indexOf(config.getBucket() + "/") + config.getBucket().length() + 1);
        try {
            client.removeObject(RemoveObjectArgs.builder()
                    .bucket(config.getBucket())
                    .object(objectKey)
                    .build());
            log.info("Deleted {}", objectKey);
        } catch (Exception e) {
            log.warn("Delete failed for {}: {}", objectKey, e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractExtension(String filename, String contentType) {
        if (filename != null && filename.contains(".")) {
            String ext = filename.substring(filename.lastIndexOf('.'));
            if (ext.length() <= 10) return ext.toLowerCase();
        }
        return switch (contentType) {
            case "image/png"     -> ".png";
            case "image/jpeg"    -> ".jpg";
            case "image/webp"    -> ".webp";
            case "image/svg+xml" -> ".svg";
            case "image/gif"     -> ".gif";
            default              -> "";
        };
    }

    private String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
