package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SessionDayDto {
    private Long                     id;
    private Integer                  dayOrder;
    private String                   title;
    private String                   description;
    private LocalDate                date;
    private String                   location;
    private List<SessionActivityDto> activities;
}
