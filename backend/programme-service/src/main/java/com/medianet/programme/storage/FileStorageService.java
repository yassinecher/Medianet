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
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.Map;
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
    private final RemoteImageFetcher remoteImages;

    /** Content a browser would render or run in our origin — documents of this kind are served as downloads. */
    private static final Set<String> ACTIVE_TYPES = Set.of("text/html", "application/xhtml+xml", "image/svg+xml",
            "text/xml", "application/xml", "text/javascript", "application/javascript", "application/x-javascript");
    private static final Set<String> ACTIVE_EXTENSIONS = Set.of(".html", ".htm", ".xhtml", ".shtml", ".svg", ".svgz",
            ".xml", ".xsl", ".js", ".mjs");
    private static final Set<String> ALLOWED_VIDEOS = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo");
    private static final long        MAX_BYTES      = 10 * 1024 * 1024L;        // 10 MB (images/docs)
    private static final long        MAX_VIDEO_BYTES = 2L * 1024 * 1024 * 1024; // 2 GB (pitch videos)

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
     * Upload an image (logo, avatar, banner, photo…) and return its public URL.
     * The type comes from the file's first bytes, not from the browser's claim or
     * the file name — a renamed or unreadable file is refused with a clear
     * message instead of being stored as a broken image.
     *
     * @param folder   logical sub-directory ("logos", "banners", "avatars", "partners"…)
     * @param allowSvg SVG can carry scripts: staff only
     */
    public String uploadImage(String folder, MultipartFile file, boolean allowSvg) {
        byte[] bytes = readCapped(file);
        String type = RemoteImageFetcher.sniff(bytes);
        if (type == null) {
            throw new IllegalArgumentException(isHeifFamily(bytes)
                    ? "Les photos HEIC / AVIF ne sont pas prises en charge : enregistrez-la en JPG ou PNG, puis réessayez."
                    : "Ce fichier n'est pas une image lisible : utilisez un PNG, JPG, WebP ou GIF.");
        }
        if (type.equals("image/svg+xml") && !allowSvg) {
            throw new IllegalArgumentException("Les images SVG ne sont pas acceptées ici : utilisez un PNG, JPG ou WebP.");
        }
        return store(folder, "uploads", bytes, type, RemoteImageFetcher.extensionOf(type), false);
    }

    /**
     * Upload a document (PDF, deck, archive, image…) and return its public URL.
     * Files a browser would run as a page (HTML, SVG, XML, JS) are stored as
     * downloads, so a public link can never serve a script from our domain.
     */
    public String uploadDocument(String folder, MultipartFile file) {
        byte[] bytes = readCapped(file);
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String ext = extractExtension(file.getOriginalFilename(), contentType);
        boolean active = ACTIVE_TYPES.contains(contentType.toLowerCase())
                || ACTIVE_EXTENSIONS.contains(ext)
                || "image/svg+xml".equals(RemoteImageFetcher.sniff(bytes))
                || RemoteImageFetcher.looksLikeHtml(bytes);
        return store(folder, "documents", bytes, active ? "application/octet-stream" : contentType, ext, active);
    }

    private byte[] readCapped(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier est vide.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Le fichier dépasse 10 MB.");
        }
        try {
            return file.getBytes();
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("Le fichier n'a pas pu être lu.");
        }
    }

    /** HEIC / HEIF / AVIF (ISO-BMFF "ftyp" box) — what phones often produce. */
    private static boolean isHeifFamily(byte[] b) {
        if (b.length < 12 || b[4] != 'f' || b[5] != 't' || b[6] != 'y' || b[7] != 'p') return false;
        String brand = new String(b, 8, 4, java.nio.charset.StandardCharsets.US_ASCII);
        return Set.of("heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif", "avis").contains(brand);
    }

    private String store(String folder, String defaultFolder, byte[] bytes, String contentType, String ext,
                         boolean asDownload) {
        String safeFolder = (folder == null || folder.isBlank()) ? defaultFolder : folder.replaceAll("[^a-zA-Z0-9_-]", "_");
        String objectKey  = "%s/%s/%s%s".formatted(safeFolder, LocalDate.now(), UUID.randomUUID(), ext);
        PutObjectArgs.Builder put = PutObjectArgs.builder()
                .bucket(config.getBucket())
                .object(objectKey)
                .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                .contentType(contentType);
        if (asDownload) put.headers(Map.of("Content-Disposition", "attachment"));
        try {
            client.putObject(put.build());
            String url = "%s/%s/%s".formatted(stripTrailingSlash(config.getPublicUrl()), config.getBucket(), objectKey);
            log.info("Uploaded {} ({} bytes) -> {}", objectKey, bytes.length, url);
            return url;
        } catch (Exception e) {
            log.error("Upload failed", e);
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }

    /**
     * Import an image from a pasted link (share links of Drive / Dropbox / GitHub
     * are understood): downloaded server-side, then stored like an upload, so the
     * site never depends on the original host. See {@link RemoteImageFetcher}.
     */
    public String importFromUrl(String folder, String link, boolean allowSvg) {
        RemoteImageFetcher.Fetched img = remoteImages.fetch(link, allowSvg);
        return store(folder, "uploads", img.bytes(), img.contentType(), img.extension(), false);
    }

    /**
     * Upload a pitch video (larger cap + video content types). Returns the public URL.
     */
    public String uploadVideo(String folder, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vidéo vide");
        }
        if (file.getSize() > MAX_VIDEO_BYTES) {
            throw new IllegalArgumentException("Vidéo trop lourde (max 2 Go)");
        }
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        if (!ALLOWED_VIDEOS.contains(contentType)) {
            throw new IllegalArgumentException("Format vidéo non supporté (MP4, WebM, MOV, MKV, AVI) — reçu : " + contentType);
        }
        String safeFolder = (folder == null || folder.isBlank()) ? "pitch-videos" : folder.replaceAll("[^a-zA-Z0-9_-]", "_");
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
            log.info("Uploaded video {} ({} bytes) -> {}", objectKey, file.getSize(), url);
            return url;
        } catch (Exception e) {
            log.error("Video upload failed", e);
            throw new RuntimeException("Échec de l'envoi de la vidéo : " + e.getMessage(), e);
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
            String ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            if (ext.matches("\\.[a-z0-9]{1,9}")) return ext;
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
