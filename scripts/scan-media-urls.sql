-- ─────────────────────────────────────────────────────────────────────────────
-- Scan a Medianet database for stored media (MinIO) URLs and report which base
-- hosts they point at.
--
-- Uploaded files are stored as absolute URLs built by FileStorageService:
--     <MINIO_PUBLIC_URL>/<bucket>/<object-key>
-- When MINIO_PUBLIC_URL changes (IP -> domain), old rows keep the OLD base and
-- silently break. This tells you exactly which bases exist and where.
--
-- Read-only: makes no changes.
--
-- Usage (per database):
--   psql -U medianet -d programme_db -v bucket=medianet -f scan-media-urls.sql
--
-- Or across the whole stack:  scripts/migrate-media-urls.sh   (MODE=scan)
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Default the bucket when the caller didn't pass -v bucket=…
\if :{?bucket}
\else
  \set bucket medianet
\endif

SELECT set_config('mig.bucket', :'bucket', false);

-- pg_temp-qualified so this can never drop a real table of the same name.
DROP TABLE IF EXISTS pg_temp._media_url_scan;
CREATE TEMP TABLE _media_url_scan (tbl text, col text, base text, n bigint);

DO $$
DECLARE
  r   record;
  pat text := '/' || coalesce(nullif(current_setting('mig.bucket', true), ''), 'medianet') || '/';
BEGIN
  -- Walk every text-ish column in the schema rather than a hand-written list:
  -- URLs also hide in @ElementCollection tables (programme_gallery,
  -- phase_gallery…) and in TEXT/JSON blobs, which a fixed list would miss.
  FOR r IN
    SELECT c.table_schema AS sch, c.table_name AS tbl, c.column_name AS col
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND c.data_type IN ('character varying', 'text', 'character', 'json', 'jsonb')
    ORDER BY 1, 2, 3
  LOOP
    EXECUTE format(
      'INSERT INTO _media_url_scan
         SELECT %L, %L, m[1], count(*)
         FROM %I.%I, LATERAL regexp_matches(%I::text, %L, ''g'') AS m
         GROUP BY m[1]',
      r.tbl, r.col, r.sch, r.tbl, r.col, '(https?://[^/]+)' || pat);
  END LOOP;
END $$;

\echo ''
\echo '=== media URL bases found in this database ==='
SELECT current_database()                          AS database,
       base                                        AS base_url,
       sum(n)                                      AS occurrences,
       string_agg(DISTINCT tbl || '.' || col, ', ' ORDER BY tbl || '.' || col) AS found_in
FROM _media_url_scan
GROUP BY base
ORDER BY sum(n) DESC;
