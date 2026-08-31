package com.medianet.programme.dto;

import lombok.Data;

/** Small request bodies for the rich task actions (attachments, steps, etc.). */
public final class TaskActionRequests {
    private TaskActionRequests() {}

    @Data public static class AttachmentRequest {
        /** RESOURCE (brief, by admin/mentor) or SUBMISSION (deliverable). Defaults SUBMISSION. */
        private String kind;
        private String url;
        private String name;
        private Long sizeBytes;
        private String contentType;
    }

    @Data public static class StepRequest {
        private String title;
    }

    @Data public static class StepUpdateRequest {
        private Boolean done;
        private String title;
    }

    @Data public static class CollaboratorRequest {
        private Long userId;
        private String name;
        private String role;
    }

    @Data public static class CommentRequest {
        private String note;
    }
}
