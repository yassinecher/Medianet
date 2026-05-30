package com.medianet.adminai.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** A chat conversation between an admin and the AI assistant. */
@Entity
@Table(name = "ai_conversations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long adminId;

    @Column(nullable = false)
    private String adminName;

    /** Short title derived from the first user message. */
    @Column(columnDefinition = "TEXT")
    private String title;

    /** Ordered list of messages serialized as JSON in the messages table. */
    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<AiMessage> messages = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
