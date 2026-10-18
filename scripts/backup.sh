#!/usr/bin/env bash
# Daily encrypted offsite backup of the Ngaji SQLite database.
# Run by ngaji-backup.service (env from /etc/ngaji/backup.env). See DEPLOYMENT.md.
#
# online .backup -> integrity_check -> gzip -> age (public key only) -> rclone upload
# -> prune remote (daily 30d, monthly 365d) and local (newest 7) -> healthcheck ping.
set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/ngaji/production.db}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/var/backups/ngaji}"
BACKUP_BUCKET="${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
AGE_RECIPIENT="${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:?HEALTHCHECK_URL is required}"
REMOTE="idch:${BACKUP_BUCKET}"

export TZ=Asia/Jakarta
TODAY="$(date +%F)"
MONTH="$(date +%Y-%m)"
DAILY_NAME="ngaji-${TODAY}.db.gz.age"
MONTHLY_NAME="ngaji-${MONTH}.db.gz.age"

umask 077
mkdir -p "$LOCAL_BACKUP_DIR"
TMP_DB="$LOCAL_BACKUP_DIR/tmp-${TODAY}.db"
TMP_ENC="$LOCAL_BACKUP_DIR/tmp-${TODAY}.db.gz.age"

ping_healthcheck() {
  # A failed ping must not fail the backup itself; a missed ping alerts via the grace period.
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_URL}${1:-}" || true
}

cleanup() { rm -f "$TMP_DB" "$TMP_ENC"; }
on_error() {
  local code=$?
  echo "backup FAILED (exit ${code}) at line ${1}" >&2
  ping_healthcheck /fail
  exit "$code"
}
trap cleanup EXIT
trap 'on_error $LINENO' ERR

rm -f "$TMP_DB" "$TMP_ENC"

# 1. Consistent copy while the app keeps writing (SQLite online backup API).
sqlite3 "$DB_PATH" ".backup '${TMP_DB}'"

# 2. Never upload a corrupt snapshot.
RESULT="$(sqlite3 "$TMP_DB" 'PRAGMA integrity_check;')"
if [ "$RESULT" != "ok" ]; then
  echo "integrity_check failed" >&2
  false
fi

# 3. Compress, then encrypt with the public key. The plaintext never leaves this host.
gzip -9 -c "$TMP_DB" | age -r "$AGE_RECIPIENT" -o "$TMP_ENC"
rm -f "$TMP_DB"

# 4. Keep a local copy, upload daily, and monthly if this month has none yet.
cp "$TMP_ENC" "$LOCAL_BACKUP_DIR/$DAILY_NAME"
rclone copyto "$LOCAL_BACKUP_DIR/$DAILY_NAME" "$REMOTE/daily/$DAILY_NAME"
if [ -z "$(rclone lsf "$REMOTE/monthly/" --include "$MONTHLY_NAME")" ]; then
  rclone copyto "$LOCAL_BACKUP_DIR/$DAILY_NAME" "$REMOTE/monthly/$MONTHLY_NAME"
fi

# 5. Prune remote (30 days daily, 365 days monthly) and local (newest 7).
rclone delete --min-age 30d "$REMOTE/daily/"
rclone delete --min-age 365d "$REMOTE/monthly/"
# shellcheck disable=SC2012  # names are our own ngaji-YYYY-MM-DD.db.gz.age
ls -1t "$LOCAL_BACKUP_DIR"/ngaji-*.db.gz.age 2>/dev/null | tail -n +8 | xargs -r rm -f --

# 6. Success.
ping_healthcheck
echo "backup OK: $DAILY_NAME"
