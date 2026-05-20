package com.medianet.session.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UpdateSessionRequest {
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate submissionDeadline;
    private Integer maxProjects;
}
