#!/usr/bin/env sh
set -eu

APP_CONTAINER="${APP_CONTAINER:-queenangle-app}"
DATA_DIR="${DATA_DIR:-/var/lib/queenangle}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/queenangle}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

timestamp="$(date +%Y%m%d-%H%M%S)"
archive="${BACKUP_DIR}/queenangle-${timestamp}.tar.gz"

mkdir -p "$BACKUP_DIR"

if docker ps --format '{{.Names}}' | grep -qx "$APP_CONTAINER"; then
  docker exec "$APP_CONTAINER" node -e "const Database=require('better-sqlite3'); const db=new Database(process.env.DB_PATH || '/data/db/queenangle.sqlite'); db.pragma('wal_checkpoint(TRUNCATE)'); db.close();"
fi

if [ ! -f "${DATA_DIR}/db/queenangle.sqlite" ]; then
  echo "Database not found: ${DATA_DIR}/db/queenangle.sqlite" >&2
  exit 1
fi

tar -czf "$archive" -C "$DATA_DIR" db uploads
tar -tzf "$archive" >/dev/null

find "$BACKUP_DIR" -name 'queenangle-*.tar.gz' -type f -mtime "+${RETENTION_DAYS}" -delete

echo "$archive"
