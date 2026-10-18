#!/usr/bin/env bash
# Restore the Ngaji database from an encrypted backup.
#
# Usage: restore.sh <object|file> <age-identity-file>
#   <object>  a name in the bucket, e.g. daily/ngaji-2026-11-01.db.gz.age or monthly/ngaji-2026-11.db.gz.age
#             (needs rclone config and BACKUP_BUCKET, i.e. run with /etc/ngaji/backup.env loaded)
#   <file>    a local .db.gz.age path (an existing file wins over an object name)
#
# Aborts before touching production on a wrong key or a corrupt backup.
# Run as root (it stops/starts the service and chowns the result).
# Overridable for drills/tests: DB_PATH, SERVICE, APP_USER, HEALTH_URL, SKIP_SERVICE=1.
set -euo pipefail

SRC="${1:?usage: restore.sh <object|file> <age-identity-file>}"
IDENTITY="${2:?usage: restore.sh <object|file> <age-identity-file>}"
DB_PATH="${DB_PATH:-/var/lib/ngaji/production.db}"
SERVICE="${SERVICE:-ngaji}"
APP_USER="${APP_USER:-ngaji}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/login}"
SKIP_SERVICE="${SKIP_SERVICE:-0}"

[ -f "$IDENTITY" ] || { echo "identity file not found: $IDENTITY" >&2; exit 1; }

umask 077
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1. Fetch (if remote) and decrypt + gunzip into a temp file. Nothing in production is touched yet.
if [ -f "$SRC" ]; then
  ENC="$SRC"
else
  BACKUP_BUCKET="${BACKUP_BUCKET:?BACKUP_BUCKET is required to fetch from the bucket}"
  ENC="$WORK/backup.age"
  rclone copyto "idch:${BACKUP_BUCKET}/${SRC}" "$ENC"
fi
RESTORED="$WORK/restored.db"
age -d -i "$IDENTITY" "$ENC" | gunzip -c > "$RESTORED"

# 2. Verify integrity.
RESULT="$(sqlite3 "$RESTORED" 'PRAGMA integrity_check;')"
if [ "$RESULT" != "ok" ]; then
  echo "restored database failed integrity_check; production untouched" >&2
  exit 1
fi

# 3. Stop the app, keep the current database aside.
TS="$(date +%Y%m%d-%H%M%S)"
[ "$SKIP_SERVICE" = "1" ] || systemctl stop "$SERVICE"
if [ -e "$DB_PATH" ]; then
  mv "$DB_PATH" "$DB_PATH.pre-restore-$TS"
  echo "previous database kept at $DB_PATH.pre-restore-$TS"
fi
rm -f "$DB_PATH-wal" "$DB_PATH-shm"

# 4. Install the restored file, then start and check.
install -m 600 -o "$APP_USER" -g "$APP_USER" "$RESTORED" "$DB_PATH" 2>/dev/null \
  || install -m 600 "$RESTORED" "$DB_PATH"
if [ "$SKIP_SERVICE" != "1" ]; then
  systemctl start "$SERVICE"
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "$HEALTH_URL"; then
      echo "restore OK: service answers on $HEALTH_URL"
      exit 0
    fi
    sleep 1
  done
  echo "service did not answer on $HEALTH_URL; previous DB is at $DB_PATH.pre-restore-$TS" >&2
  exit 1
fi
echo "restore OK (service handling skipped)"
