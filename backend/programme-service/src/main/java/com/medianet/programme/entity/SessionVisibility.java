package com.medianet.programme.entity;

/**
 * Controls who can see a session and where it is rendered.
 *
 * <ul>
 *   <li>{@code VISIBLE}  — shown in the public programme timeline to invited /
 *       programme-level users.</li>
 *   <li>{@code HIDDEN}   — exists in the system but is NOT shown in the public
 *       timeline; only privileged users (admin / program manager) see it,
 *       flagged « Interne ».</li>
 *   <li>{@code PRIVATE}  — only explicitly invited users (and admins) may access
 *       it; never rendered in the public timeline.</li>
 * </ul>
 */
public enum SessionVisibility {
    VISIBLE,
    HIDDEN,
    PRIVATE
}
