package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class CreateSessionDayRequest {
    private Integer                       dayOrder;
    private String                        title;
    private String                        description;
    private LocalDate                     date;
    private String                        location;
    /** Optional — activities can also be added later via the activity endpoints. */
    private List<CreateSessionActivityRequest> activities;
}
