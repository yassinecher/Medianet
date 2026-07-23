package com.medianet.programme.controller;

import com.medianet.programme.service.CanvaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Canva Connect endpoints. Rides the gateway route {@code /api/canva/**}.
 * The OAuth callback is anonymous (Canva's redirect carries no JWT) — it is
 * safe because it only completes a PKCE flow this server itself initiated.
 */
@RestController
@RequestMapping("/api/canva")
@RequiredArgsConstructor
@Slf4j
public class CanvaController {

    private final CanvaService canvaService;

    /** Is Canva configured server-side, and is THIS user connected? */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        String email = currentEmail();
        return ResponseEntity.ok(Map.of(
                "configured", canvaService.configured(),
                "connected", canvaService.configured() && canvaService.connected(email)));
    }

    /** PKCE authorize URL — the studio opens it in a popup. */
    @GetMapping("/connect-url")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Map<String, String>> connectUrl() {
        return ResponseEntity.ok(Map.of("url", canvaService.authorizeUrl(currentEmail())));
    }

    @DeleteMapping("/connection")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Void> disconnect() {
        canvaService.disconnect(currentEmail());
        return ResponseEntity.noContent().build();
    }

    /** OAuth redirect target — closes the popup and notifies the opener. */
    @GetMapping(value = "/callback", produces = MediaType.TEXT_HTML_VALUE)
    public String callback(@RequestParam(required = false) String code,
                           @RequestParam(required = false) String state,
                           @RequestParam(required = false) String error,
                           @RequestParam(value = "error_description", required = false) String errorDescription) {
        String msg;
        if (error != null || code == null) {
            log.warn("Canva authorize refused: error={} description={}", error, errorDescription);
            msg = "Connexion Canva refusée"
                    + (error != null ? " — code : « " + error + " »" : "")
                    + (errorDescription != null ? " (" + errorDescription + ")" : "")
                    + ". Vérifiez sur canva.dev : scopes activés (design:content:write, design:meta:read) "
                    + "et connectez-vous avec le compte Canva propriétaire de l'intégration (obligatoire tant qu'elle est en brouillon).";
        } else {
            try {
                canvaService.handleCallback(state, code);
                msg = "Canva connecté ! Cette fenêtre va se fermer…";
            } catch (Exception e) {
                log.warn("Canva callback failed: {}", e.getMessage());
                msg = "Échec de la connexion Canva : " + e.getMessage();
            }
        }
        return "<!doctype html><html lang=\"fr\"><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:96vh\">"
                + "<p>" + msg + "</p>"
                + "<script>try{window.opener&&window.opener.postMessage('canva-connected','*')}catch(e){};setTimeout(()=>window.close(),1800)</script>"
                + "</body></html>";
    }

    /** Upload the generated .pptx to Canva as a new design; returns its edit URL. */
    @PostMapping("/import")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<Map<String, String>> importDesign(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title) throws Exception {
        String editUrl = canvaService.importPptx(currentEmail(), title, file.getBytes());
        return ResponseEntity.ok(Map.of("editUrl", editUrl));
    }

    private String currentEmail() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a == null ? null : String.valueOf(a.getPrincipal());
    }
}
