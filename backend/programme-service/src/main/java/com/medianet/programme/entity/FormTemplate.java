package com.medianet.programme.entity;

/**
 * Which formulaire layout porteurs see when they click "Rejoindre le programme".
 *
 * <p>The frontoffice reads {@code programme.formTemplate} on the /candidater page
 * and shows/hides sections accordingly. The backend stores any text in the relevant
 * fields, so changing template doesn't affect existing candidatures.
 */
public enum FormTemplate {
    /**
     * Default — all 4 sections from the official Medianet "Appel à candidature" DOCX:
     * team + project + market + motivation.
     */
    STANDARD,

    /**
     * Streamlined — only project + motivation. Used for one-off contests, hackathons,
     * or invitation-only programmes where the porteur is already known.
     */
    MINIMAL,

    /**
     * FoodTech-flavoured — STANDARD + emphasis on production/distribution channels,
     * food safety certifications, target retailers. Used for FoodStart-style programmes.
     */
    FOODSTART,

    /**
     * Tech / SaaS / AI startups — STANDARD + emphasis on tech stack, scalability,
     * IP/patents, beta users. Skips physical-distribution questions.
     */
    TECH,

    /**
     * Agriculture / Agritech — STANDARD + emphasis on land/farm partnerships,
     * crop cycles, supply chain, sustainability metrics.
     */
    AGRITECH
}
