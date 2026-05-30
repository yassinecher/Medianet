package com.medianet.programme.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LandingFaq {
    @Column(name = "faq_question", columnDefinition = "TEXT")
    private String question;

    @Column(name = "faq_answer", columnDefinition = "TEXT")
    private String answer;
}
