package com.medianet.auth.dto;

import lombok.Data;

@Data
public class UpdateCoachingPlanRequest {
    private String milestonesJson;
    private String notes;
}
