package com.medianet.programme.dto;

import lombok.*;

import java.time.LocalDate;

@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateSessionDayRequest {
    private Integer   dayOrder;
    private String    title;
    private String    description;
    private LocalDate date;
    private String    location;
}
