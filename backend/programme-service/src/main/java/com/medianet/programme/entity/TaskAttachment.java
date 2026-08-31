package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.time.LocalDateTime;

/** A document/link attached to a task — either a RESOURCE (brief, by the
 *  admin/mentor) or a SUBMISSION (the assignee's deliverable / rendu). */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskAttachment {
    /** Stable client-facing id (UUID) so a single attachment can be removed. */
    private String code;
    /** RESOURCE · SUBMISSION */
    @Column(length = 16)
    private String kind;
    @Column(length = 1024)
    private String url;
    private String name;
    private Long sizeBytes;
    /** MIME type when uploaded ("application/pdf", "image/png"…). */
    private String contentType;
    private Long uploadedByUserId;
    private String uploadedByName;
    private LocalDateTime createdAt;
}
