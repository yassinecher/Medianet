-- ─────────────────────────────────────────────────────────────────────────────
-- Rewrite stored media (MinIO) URLs from an old base host to a new one.
--
-- Uploaded files are stored as ABSOLUTE URLs:
--     <MINIO_PUBLIC_URL>/<bucket>/<object-key>
-- so changing MINIO_PUBLIC_URL (e.g. http://1.2.3.4:9000 -> https://api.example)
-- leaves every existing row pointing at the old host. This rewrites them.
--
-- Only the BASE is replaced, and only where it matches exactly — external links
-- (linkedInUrl, twitterUrl, applicationUrl…) are never touched because they
-- don't contain the old base.
--
-- DRY RUN by default. Nothing changes unless you pass -v apply=1.
-- The whole run is one transaction: any error rolls everything back.
--
-- Usage:
--   psql -U medianet -d programme_db \
--        -v old_base='http://129.151.237.69:9000' \
--        -v new_base='https://medianetincubatorbackend.duckdns.org' \
--        -v apply=0 -f migrate-media-urls.sql
--
-- Or across the whole stack:  scripts/migrate-media-urls.sh   (MODE=dry|apply)
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Fail loudly rather than silently no-op if the bases weren't supplied.
\if :{?old_base}
\else
  \echo 'ERROR: -v old_base=... is required'
  \quit 1
\endif
\if :{?new_base}
\else
  \echo 'ERROR: -v new_base=... is required'
  \quit 1
\endif
-- Default to a dry run when the caller didn't say.
\if :{?apply}
\else
  \set apply 0
\endif

SELECT set_config('mig.old',   :'old_base', false),
       set_config('mig.new',   :'new_base', false),
       set_config('mig.apply', :'apply',    false);

BEGIN;

DO $$
DECLARE
  r        record;
  old_base text    := current_setting('mig.old', true);
  new_base text    := current_setting('mig.new', true);
  do_apply boolean := lower(coalesce(current_setting('mig.apply', true), '0'))
                        IN ('1', 'true', 't', 'yes', 'y');
  hits     bigint;
  total    bigint := 0;
BEGIN
  IF old_base IS NULL OR old_base = '' THEN
    RAISE EXCEPTION 'old_base is required (-v old_base=''http://old-host:9000'')';
  END IF;
  IF new_base IS NULL OR new_base = '' THEN
    RAISE EXCEPTION 'new_base is required (-v new_base=''https://new-host'')';
  END IF;
  IF old_base = new_base THEN
    RAISE NOTICE 'old_base = new_base — nothing to do'; RETURN;
  END IF;

  RAISE NOTICE '--- % : % -> %  (%)', current_database(), old_base, new_base,
               CASE WHEN do_apply THEN 'APPLY' ELSE 'dry run' END;

  -- Schema-driven rather than a hand-written column list: media URLs also live
  -- in @ElementCollection tables (programme_gallery, phase_gallery…) and inside
  -- TEXT/JSON blobs, which a fixed list would silently miss.
  FOR r IN
    SELECT c.table_schema AS sch, c.table_name AS tbl,
           c.column_name  AS col, c.data_type  AS typ
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND c.data_type IN ('character varying', 'text', 'character', 'json', 'jsonb')
      AND c.is_generated = 'NEVER'
    ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I::text LIKE %L',
                   r.sch, r.tbl, r.col, '%' || old_base || '%')
      INTO hits;
    CONTINUE WHEN hits = 0;

    total := total + hits;
    RAISE NOTICE '  %  %.%  (% row(s))',
                 CASE WHEN do_apply THEN 'rewriting' ELSE 'would rewrite' END,
                 r.tbl, r.col, hits;

    IF do_apply THEN
      IF r.typ IN ('json', 'jsonb') THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
          r.sch, r.tbl, r.col, r.col, old_base, new_base, r.typ,
          r.col, '%' || old_base || '%');
      ELSE
        EXECUTE format(
          'UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
          r.sch, r.tbl, r.col, r.col, old_base, new_base,
          r.col, '%' || old_base || '%');
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '=== % : % row(s) %', current_database(), total,
               CASE WHEN do_apply THEN 'rewritten' ELSE 'would be rewritten (dry run)' END;
END $$;

COMMIT;
