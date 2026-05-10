#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /var/backups/queenangle/queenangle-YYYYmmdd-HHMMSS.tar.gz" >&2
  exit 1
fi

BACKUP_ARCHIVE="$1"
APP_DIR="${APP_DIR:-/opt/queenangle/app}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DATA_DIR="${DATA_DIR:-/var/lib/queenangle}"
PRE_RESTORE_DIR="${PRE_RESTORE_DIR:-/var/backups/queenangle}"

if [ ! -f "$BACKUP_ARCHIVE" ]; then
  echo "Backup archive not found: $BACKUP_ARCHIVE" >&2
  exit 1
fi

tar -tzf "$BACKUP_ARCHIVE" >/dev/null
mkdir -p "$DATA_DIR" "$PRE_RESTORE_DIR"

if [ -d "${DATA_DIR}/db" ] || [ -d "${DATA_DIR}/uploads" ]; then
  pre_restore="${PRE_RESTORE_DIR}/pre-restore-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$pre_restore" -C "$DATA_DIR" db uploads 2>/dev/null || true
  echo "Current data snapshot: $pre_restore"
fi

cd "$APP_DIR"
docker compose --env-file /etc/queenangle.env -f "$COMPOSE_FILE" stop queenangle-app
tar -xzf "$BACKUP_ARCHIVE" -C "$DATA_DIR"
docker compose --env-file /etc/queenangle.env -f "$COMPOSE_FILE" up -d queenangle-app

echo "Restore finished: $BACKUP_ARCHIVE"
