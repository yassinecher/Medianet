#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Scan / rewrite stored MinIO media URLs across every Medianet database.
#
# Uploaded files are stored as absolute URLs (<MINIO_PUBLIC_URL>/<bucket>/<key>),
# so when MINIO_PUBLIC_URL changes, existing rows keep pointing at the old host
# and their images/videos 404. This finds and fixes them.
#
# Run it ON THE SERVER, from the directory holding docker-compose.prod.yml.
#
#   MODE=scan  ./scripts/migrate-media-urls.sh        # what bases exist? (read-only)
#   MODE=dry   OLD_BASE=http://1.2.3.4:9000 ./scripts/migrate-media-urls.sh
#   MODE=apply OLD_BASE=http://1.2.3.4:9000 ./scripts/migrate-media-urls.sh
#
# MODE=apply takes a pg_dump of each database first (./media-url-backups/).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MODE=${MODE:-scan}
BUCKET=${MINIO_BUCKET:-medianet}
NEW_BASE=${NEW_BASE:-https://medianetincubatorbackend.duckdns.org}
OLD_BASE=${OLD_BASE:-}
PG_USER=${POSTGRES_USER:-medianet}

HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-./media-url-backups/$STAMP}"

# container:database — matches docker-compose.prod.yml
PAIRS=(
  "postgres-auth:${POSTGRES_AUTH_DB:-auth_db}"
  "postgres-candidature:${POSTGRES_CANDIDATURE_DB:-candidature_db}"
  "postgres-notification:${POSTGRES_NOTIFICATION_DB:-notification_db}"
  "postgres-programme:${POSTGRES_PROGRAMME_DB:-programme_db}"
  "postgres-admin-ai:${POSTGRES_ADMIN_AI_DB:-admin_ai_db}"
)

case "$MODE" in
  scan) ;;
  dry|apply)
    if [ -z "$OLD_BASE" ]; then
      echo "ERROR: OLD_BASE is required for MODE=$MODE." >&2
      echo "       Run 'MODE=scan $0' first to see which bases exist." >&2
      exit 1
    fi
    ;;
  *) echo "ERROR: MODE must be scan | dry | apply (got '$MODE')" >&2; exit 1 ;;
esac

echo "mode=$MODE  bucket=$BUCKET  new_base=$NEW_BASE${OLD_BASE:+  old_base=$OLD_BASE}"
echo

if [ "$MODE" = "apply" ]; then
  mkdir -p "$BACKUP_DIR"
  echo "==> backing up to $BACKUP_DIR (restore: psql -U $PG_USER -d <db> -f <file>)"
  for p in "${PAIRS[@]}"; do
    c="${p%%:*}"; db="${p##*:}"
    docker exec -i "$c" pg_dump -U "$PG_USER" -d "$db" > "$BACKUP_DIR/$db.sql"
    echo "    $db -> $BACKUP_DIR/$db.sql ($(wc -c < "$BACKUP_DIR/$db.sql") bytes)"
  done
  echo
fi

for p in "${PAIRS[@]}"; do
  c="${p%%:*}"; db="${p##*:}"
  echo "════════ $c / $db ════════"
  if [ "$MODE" = "scan" ]; then
    docker exec -i "$c" psql -q -U "$PG_USER" -d "$db" \
      -v bucket="$BUCKET" -f - < "$HERE/scan-media-urls.sql"
  else
    apply=0; [ "$MODE" = "apply" ] && apply=1
    docker exec -i "$c" psql -q -U "$PG_USER" -d "$db" \
      -v old_base="$OLD_BASE" -v new_base="$NEW_BASE" -v apply="$apply" \
      -f - < "$HERE/migrate-media-urls.sql"
  fi
  echo
done

if [ "$MODE" = "dry" ]; then
  echo "Dry run only — nothing changed. Re-run with MODE=apply to write."
fi
