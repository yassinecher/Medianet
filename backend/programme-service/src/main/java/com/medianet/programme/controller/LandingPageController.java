package com.medianet.programme.controller;

import com.medianet.programme.dto.LandingPageDto;
import com.medianet.programme.service.LandingPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/landing-page")
@RequiredArgsConstructor
public class LandingPageController {

    private final LandingPageService service;

    /** Public — anyone can fetch the landing-page content. */
    @GetMapping
    public ResponseEntity<LandingPageDto> get() {
        return ResponseEntity.ok(service.get());
    }

    /** ADMIN — update the landing page. */
    @PutMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<LandingPageDto> update(@RequestBody LandingPageDto req) {
        return ResponseEntity.ok(service.update(req));
    }

    /** ADMIN — reset to defaults. */
    @PostMapping("/reset")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('programmes:update')")
    public ResponseEntity<LandingPageDto> reset() {
        return ResponseEntity.ok(service.reset());
    }
}
