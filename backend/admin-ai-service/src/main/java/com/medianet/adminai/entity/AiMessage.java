package com.medianet.adminai.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_messages")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    @JsonIgnore
    private AiConversation conversation;

    /** "user" | "assistant" — matches Anthropic message API. */
    @Column(nullable = false)
    private String role;

    /**
     * Full message content as a JSON-stringified block array
     * (text blocks, tool_use blocks, tool_result blocks).
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String contentJson;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
