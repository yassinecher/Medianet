package com.medianet.programme.repository;

import com.medianet.programme.entity.Programme;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Native access to the soft-deleted (trashed) rows of this service. Every entity
 * carries {@code @SQLRestriction("deleted_at is null")}, so normal JPQL/finders
 * can never see trashed rows — these native queries are how the trash is listed,
 * restored and purged. Native SQL is not subject to the restriction.
 */
public interface TrashRepository extends Repository<Programme, Long> {

    /**
     * Every trashed row across the service, as {@code [type, id, label, deletedAt]}.
     * Kept as Object[] on purpose — a UNION over four tables doesn't map cleanly to
     * a single entity, and Object[] sidesteps native-projection column-case issues.
     */
    @Query(value = """
        SELECT 'programme' AS type, id, title AS label, deleted_at AS deleted_at
          FROM programmes WHERE deleted_at IS NOT NULL
        UNION ALL
        SELECT 'session', id, title, deleted_at
          FROM programme_phases WHERE deleted_at IS NOT NULL
        UNION ALL
        SELECT 'task', id, title, deleted_at
          FROM tasks WHERE deleted_at IS NOT NULL
        UNION ALL
        SELECT 'pitch', id, COALESCE(title, project_name, video_filename, CONCAT('Pitch #', id)), deleted_at
          FROM pitch_submissions WHERE deleted_at IS NOT NULL
        ORDER BY 4 DESC
        """, nativeQuery = true)
    List<Object[]> findAllTrashed();

    // ── Restore (clear the soft-delete flag) ────────────────────────────────
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE programmes SET deleted_at = NULL WHERE id = :id", nativeQuery = true)
    int restoreProgramme(@Param("id") Long id);

    /** A range session restores together with the nested day-sessions trashed with it. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE programme_phases SET deleted_at = NULL WHERE id = :id OR parent_session_id = :id", nativeQuery = true)
    int restoreSession(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE tasks SET deleted_at = NULL WHERE id = :id", nativeQuery = true)
    int restoreTask(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE pitch_submissions SET deleted_at = NULL WHERE id = :id", nativeQuery = true)
    int restorePitch(@Param("id") Long id);

    // ── Purge (permanent) — leaves only; programme/session purge cascades in the service ──
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM tasks WHERE id = :id", nativeQuery = true)
    int purgeTask(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM pitch_submissions WHERE id = :id", nativeQuery = true)
    int purgePitch(@Param("id") Long id);

    /** Un-hide every session of a programme so a full JPA cascade purge can also
     *  remove the ones that were individually trashed (avoids a dangling FK). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE programme_phases SET deleted_at = NULL WHERE programme_id = :id", nativeQuery = true)
    int unhideProgrammePhases(@Param("id") Long id);
}
