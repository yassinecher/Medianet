package com.medianet.programme.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A porteur's pitch-video submission for a programme's presentation day.
 * Carries the uploaded video, its transcript (the text the AI actually
 * analyses), and the resulting AI score + advice.
 */
@Entity
@Table(name = "pitch_submissions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PitchSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Programme this pitch is for. */
    @Column(nullable = false)
    private Long programmeId;

    /** Presentation session flagged for video analysis. Nullable — programme-level pitch. */
    private Long sessionId;

    /**
     * TRAINING (practice, multiple allowed) or FINAL (the real pitch, one per session).
     * columnDefinition carries a SQL default so ddl-auto:update can add the
     * NOT NULL column to an already-populated table (existing rows → FINAL).
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false,
            columnDefinition = "varchar(16) not null default 'FINAL'")
    @Builder.Default
    private PitchKind kind = PitchKind.FINAL;

    // ── Author (porteur) ─────────────────────────────────────────────────────
    @Column(nullable = false)
    private Long porteurId;
    private String porteurName;
    private String porteurEmail;

    /** Optional linked organisation / startup. */
    private Long organizationId;
    private String companyName;
    private String projectName;

    // ── Content ──────────────────────────────────────────────────────────────
    private String title;

    /** Public URL of the uploaded video (MinIO). */
    @Column(length = 1000)
    private String videoUrl;
    private String videoFilename;

    /** The spoken pitch as text — auto-transcribed from the video (or manual). */
    @Column(columnDefinition = "TEXT")
    private String transcript;

    /** True when the transcript came from automatic speech-to-text. */
    @Builder.Default
    private Boolean autoTranscribed = false;

    /**
     * Whisper segments as JSON: [{start,end,text}] — powers the timestamped
     * transcript panel, click-to-jump and the timeline markers.
     */
    @Column(columnDefinition = "TEXT")
    private String segmentsJson;

    /** Video length in seconds (from the media pipeline). */
    private Integer durationSeconds;

    /** Free notes from the porteur (context, ask, …). */
    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    @Builder.Default
    private PitchStatus status = PitchStatus.DRAFT;

    // ── AI analysis result ───────────────────────────────────────────────────
    /** Overall pitch score 0-10. */
    private Double aiScore;

    /** Full structured analysis as JSON (criteria, strengths, weaknesses, advice…). */
    @Column(columnDefinition = "TEXT")
    private String aiAnalysisJson;

    @Builder.Default
    private Boolean aiEnhanced = false;

    private LocalDateTime analyzedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) status = PitchStatus.DRAFT;
    }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
