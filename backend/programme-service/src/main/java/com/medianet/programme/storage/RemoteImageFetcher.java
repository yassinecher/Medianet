package com.medianet.programme.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Downloads an image from a link pasted by a user (organisation logo, gallery
 * photo…) so it can be stored in MinIO exactly like an upload. Share links of
 * the usual hosts are first turned into their direct-download form (Google
 * Drive, Dropbox, GitHub, Google / Bing image results — share.google links end
 * up there) — those are what people paste, and they open an HTML page, not the
 * image.
 *
 * <p>Fetching a user-supplied URL from the server is an SSRF vector, so:
 * http(s) on the default ports only; every address the host resolves to must
 * be public (no loopback / private / link-local — which also rules out the
 * cloud metadata endpoint and the docker network); redirects are followed by
 * hand and re-checked; the body is capped at 10 MB and must sniff as an image.
 * The JVM caches the DNS answer validated here (30 s), so the connection that
 * follows uses that same address.
 */
@Component
@Slf4j
public class RemoteImageFetcher {

    /** The downloaded image: bytes + sniffed MIME type + file extension. */
    public record Fetched(byte[] bytes, String contentType, String extension) {}

    private static final long MAX_BYTES = 10 * 1024 * 1024L;
    private static final int  MAX_REDIRECTS = 4;
    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; MedianetIncubator/1.0; image import)";

    private static final Pattern DRIVE_FILE  = Pattern.compile("/file/d/([A-Za-z0-9_-]{10,})");
    private static final Pattern DRIVE_ID    = Pattern.compile("(?:^|&)id=([A-Za-z0-9_-]{10,})");
    private static final Pattern GITHUB_BLOB = Pattern.compile("^/([^/]+)/([^/]+)/blob/(.+)$");

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    public Fetched fetch(String link, boolean allowSvg) {
        URI original = parse(link);
        String originalHost = original.getHost().toLowerCase(Locale.ROOT);
        URI uri = toDirectLink(original);

        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            checkPublic(uri);
            HttpResponse<InputStream> res = send(uri);
            int status = res.statusCode();

            if (status >= 300 && status < 400) {
                String location = res.headers().firstValue("location").orElse(null);
                closeQuietly(res);
                if (location == null || location.isBlank()) {
                    throw new RemoteImageException("Le site a redirigé ce lien sans destination.", true);
                }
                try {
                    uri = uri.resolve(location.trim().replace(" ", "%20"));
                } catch (IllegalArgumentException e) {
                    throw new RemoteImageException("Le site a redirigé ce lien vers une adresse invalide.", true);
                }
                // e.g. share.google/… → google.com/imgres?imgurl=<the image>
                uri = fromImageSearch(uri);
                continue;
            }
            if (status >= 400) {
                closeQuietly(res);
                throw httpError(status, originalHost);
            }

            String declared = res.headers().firstValue("content-type").orElse("")
                    .toLowerCase(Locale.ROOT);
            String finalHost = uri.getHost().toLowerCase(Locale.ROOT);
            if (declared.startsWith("text/html") || declared.startsWith("application/xhtml")) {
                closeQuietly(res);
                throw notAnImage(originalHost, finalHost, true);
            }
            long length = res.headers().firstValueAsLong("content-length").orElse(-1);
            if (length > MAX_BYTES) {
                closeQuietly(res);
                throw new RemoteImageException("L'image dépasse 10 MB.");
            }

            byte[] body = readCapped(res.body());
            String type = sniff(body);
            if (type == null) throw notAnImage(originalHost, finalHost, looksLikeHtml(body));
            if (type.equals("image/svg+xml") && !allowSvg) {
                throw new RemoteImageException(
                        "Les images SVG ne sont pas acceptées ici : utilisez un PNG, JPG ou WebP.");
            }
            return new Fetched(body, type, extensionOf(type));
        }
        throw new RemoteImageException("Ce lien redirige trop de fois.", true);
    }

    // ── Link handling ─────────────────────────────────────────────────────────

    private static URI parse(String link) {
        String s = link == null ? "" : link.trim();
        if (s.isEmpty()) throw new RemoteImageException("Collez un lien vers une image.");
        if (s.startsWith("//")) s = "https:" + s;
        else if (!s.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) s = "https://" + s;  // "www.site.tn/logo.png"
        try {
            URI uri = URI.create(s.replace(" ", "%20"));
            if (uri.getHost() == null) throw new IllegalArgumentException();
            return uri;
        } catch (IllegalArgumentException e) {
            throw new RemoteImageException("Ce lien n'est pas une adresse web valide.");
        }
    }

    /**
     * Image-search result pages carry the real image URL as a parameter: Google
     * (also where share.google links land, after redirects) and Bing.
     */
    static URI fromImageSearch(URI uri) {
        if (uri.getHost() == null) return uri;
        String host  = uri.getHost().toLowerCase(Locale.ROOT);
        String path  = uri.getRawPath() == null ? "" : uri.getRawPath();
        String query = uri.getRawQuery() == null ? "" : uri.getRawQuery();
        if (host.matches("(www\\.)?google\\.[a-z.]+") && path.equals("/imgres")) {
            String img = queryParam(query, "imgurl");
            if (img != null) return parse(img);
        }
        if (host.matches("(www\\.)?bing\\.com") && path.startsWith("/images/")) {
            String img = queryParam(query, "mediaurl");
            if (img != null) return parse(img);
        }
        return uri;
    }

    /** Share-page links of common hosts → the URL that serves the file itself. */
    static URI toDirectLink(URI uri) {
        URI found = fromImageSearch(uri);
        if (found != uri) return found;
        String host  = uri.getHost().toLowerCase(Locale.ROOT);
        String path  = uri.getRawPath() == null ? "" : uri.getRawPath();
        String query = uri.getRawQuery() == null ? "" : uri.getRawQuery();

        if (host.equals("drive.google.com") || host.equals("docs.google.com")) {
            if (path.contains("/folders/")) {
                throw new RemoteImageException("Ce lien Google Drive ouvre un dossier : ouvrez l'image "
                        + "elle-même dans Drive, puis copiez son lien de partage.");
            }
            Matcher m = DRIVE_FILE.matcher(path);
            String id = m.find() ? m.group(1) : null;
            if (id == null) {
                Matcher q = DRIVE_ID.matcher(query);
                id = q.find() ? q.group(1) : null;
            }
            if (id != null) return URI.create("https://drive.google.com/uc?export=download&id=" + id);
        }

        if ((host.equals("dropbox.com") || host.endsWith(".dropbox.com")) && !host.startsWith("dl.")) {
            String kept = query.replaceAll("(^|&)(dl|raw)=[^&]*", "").replaceAll("^&", "");
            return URI.create("https://" + uri.getRawAuthority() + path + "?"
                    + (kept.isEmpty() ? "" : kept + "&") + "raw=1");
        }

        if (host.equals("github.com")) {
            Matcher m = GITHUB_BLOB.matcher(path);
            if (m.matches()) {
                return URI.create("https://raw.githubusercontent.com/" + m.group(1) + "/" + m.group(2) + "/" + m.group(3));
            }
        }
        return uri;
    }

    /** Decoded value of {@code name} in a raw query string, or null. */
    private static String queryParam(String rawQuery, String name) {
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equalsIgnoreCase(name)) {
                String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                return v.isBlank() ? null : v;
            }
        }
        return null;
    }

    // ── SSRF guard ────────────────────────────────────────────────────────────

    private static void checkPublic(URI uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new RemoteImageException("Seuls les liens http(s) sont acceptés.");
        }
        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443) {
            throw new RemoteImageException("Ce lien utilise un port non autorisé.");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) throw new RemoteImageException("Ce lien n'est pas une adresse web valide.");
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new RemoteImageException("Site introuvable : " + host);
        }
        for (InetAddress a : addresses) {
            if (!isPublic(a)) {
                log.warn("Image import refused: {} resolves to non-public {}", host, a.getHostAddress());
                throw new RemoteImageException("Ce lien pointe vers une adresse interne : refusé.");
            }
        }
    }

    static boolean isPublic(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
                || a.isSiteLocalAddress() || a.isMulticastAddress()) return false;
        byte[] b = a.getAddress();
        if (a instanceof Inet4Address) {
            int b0 = b[0] & 0xff, b1 = b[1] & 0xff, b2 = b[2] & 0xff;
            if (b0 == 0) return false;                                // 0.0.0.0/8
            if (b0 == 100 && b1 >= 64 && b1 <= 127) return false;      // carrier-grade NAT
            if (b0 == 192 && b1 == 0 && b2 == 0) return false;         // IETF protocol assignments
            if (b0 == 198 && (b1 == 18 || b1 == 19)) return false;     // benchmarking
            return b0 < 240;                                           // reserved + broadcast
        }
        if ((b[0] & 0xfe) == 0xfc) return false;                       // fc00::/7 unique local
        if ((b[0] & 0xff) == 0x00 && (b[1] & 0xff) == 0x64
                && (b[2] & 0xff) == 0xff && (b[3] & 0xff) == 0x9b) return false; // NAT64
        if ((b[0] & 0xff) == 0x20 && (b[1] & 0xff) == 0x02) return false;     // 6to4
        return true;
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private HttpResponse<InputStream> send(URI uri) {
        HttpRequest req;
        try {
            req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5")
                    .GET().build();
        } catch (IllegalArgumentException e) {
            throw new RemoteImageException("Ce lien n'est pas une adresse web valide.");
        }
        try {
            return http.send(req, HttpResponse.BodyHandlers.ofInputStream());
        } catch (HttpTimeoutException e) {
            throw new RemoteImageException("Le site ne répond pas (délai dépassé).", true);
        } catch (IOException e) {
            throw new RemoteImageException("Impossible de joindre ce site.", true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RemoteImageException("Import interrompu.", true);
        }
    }

    private static byte[] readCapped(InputStream body) {
        try (InputStream in = body) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_BYTES) throw new RemoteImageException("L'image dépasse 10 MB.");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new RemoteImageException("Le téléchargement de l'image a échoué.", true);
        }
    }

    private static void closeQuietly(HttpResponse<InputStream> res) {
        try { res.body().close(); } catch (IOException ignored) { /* nothing to do */ }
    }

    private static final String SAVE_AND_UPLOAD =
            "Enregistrez l'image sur votre ordinateur (clic droit → « Enregistrer l'image sous »), puis utilisez « Téléverser ».";

    private static RemoteImageException httpError(int status, String originalHost) {
        // Drive answers 401/403/404 alike for files that aren't shared publicly.
        if (isDrive(originalHost) && (status == 401 || status == 403 || status == 404)) {
            return new RemoteImageException(driveNotShared());
        }
        if (status == 404 || status == 410) {
            return new RemoteImageException("Aucune image à cette adresse (erreur " + status + ").");
        }
        return new RemoteImageException("Le site a refusé de fournir l'image (erreur " + status + "). "
                + SAVE_AND_UPLOAD, true);
    }

    private static RemoteImageException notAnImage(String originalHost, String finalHost, boolean html) {
        if (isDrive(originalHost)) return new RemoteImageException(driveNotShared());
        // A share / image-search link led to the image's real host, which serves a
        // page instead (e.g. Facebook's lookaside.fbsbx.com outside its own apps).
        if (!finalHost.equals(originalHost) && isShareOrSearch(originalHost)) {
            return new RemoteImageException("L'image de ce lien est hébergée sur " + finalHost
                    + ", qui ne permet pas de la récupérer. " + SAVE_AND_UPLOAD, true);
        }
        if (html) {
            return new RemoteImageException("Ce lien ouvre une page web, pas une image. Sur la page, faites un clic "
                    + "droit sur l'image → « Copier l'adresse de l'image », puis collez-la ici. Ou : " + SAVE_AND_UPLOAD);
        }
        return new RemoteImageException("Ce lien ne mène pas à une image (PNG, JPG, WebP, GIF ou SVG).");
    }

    private static boolean isDrive(String host) {
        return host.equals("drive.google.com") || host.equals("docs.google.com");
    }

    private static boolean isShareOrSearch(String host) {
        return host.equals("share.google") || host.matches("(www\\.)?(google|bing)\\.[a-z.]+");
    }

    private static String driveNotShared() {
        return "Google Drive ne partage pas ce fichier publiquement. Dans Drive : Partager → Accès général → "
                + "« Tous les utilisateurs disposant du lien », puis réessayez (ou téléversez le fichier).";
    }

    // ── Content sniffing ──────────────────────────────────────────────────────

    /** MIME type from the file's first bytes — the Content-Type header is not trusted. */
    static String sniff(byte[] b) {
        if (b.length >= 8 && (b[0] & 0xff) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length >= 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff) return "image/jpeg";
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "image/gif";
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        String head = textHead(b);
        if ((head.startsWith("<?xml") || head.startsWith("<svg") || head.startsWith("<!--") || head.startsWith("<!doctype svg"))
                && head.contains("<svg") && !head.contains("<html")) return "image/svg+xml";
        return null;
    }

    static boolean looksLikeHtml(byte[] b) {
        String head = textHead(b);
        return head.startsWith("<!doctype html") || head.startsWith("<html") || head.contains("<head");
    }

    private static String textHead(byte[] b) {
        int n = Math.min(b.length, 4096);
        String s = new String(b, 0, n, StandardCharsets.UTF_8);
        if (!s.isEmpty() && s.charAt(0) == '﻿') s = s.substring(1);
        return s.stripLeading().toLowerCase(Locale.ROOT);
    }

    static String extensionOf(String type) {
        return switch (type) {
            case "image/png"     -> ".png";
            case "image/jpeg"    -> ".jpg";
            case "image/webp"    -> ".webp";
            case "image/gif"     -> ".gif";
            case "image/svg+xml" -> ".svg";
            default              -> "";
        };
    }
}
