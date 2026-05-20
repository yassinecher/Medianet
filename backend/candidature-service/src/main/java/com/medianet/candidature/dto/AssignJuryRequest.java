package com.medianet.candidature.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class AssignJuryRequest {
    @NotEmpty
    private List<JuryAssignmentItem> juryAssignments;
}
