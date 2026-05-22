#!/bin/bash
# Canonical source: _tagai/scripts/backup.sh in GusAI40/openclaw-1 (branch tagai-main)
# Lives on VPS at: /home/tagai/.openclaw/backups/backup.sh
#
# Daily snapshot of agent memory + per-tenant runtime configs.
# Idempotent, atomic, WAL-safe, 7-day retention.
#
# Run manually:  /home/tagai/.openclaw/backups/backup.sh
# Cron (3am):    0 3 * * * /home/tagai/.openclaw/backups/backup.sh
#
# CHANGES 2026-05-22:
#  - REMOVED shared-projects.tar.gz (2.9 GB blob blew GitHub 99MB cap;
#    those repos are version-controlled in their own GitHub repos —
#    code is recoverable; per-tenant .env files reproducible from
#    .openclaw-shared.env + bootstrap-tenant.sh).
#  - ADDED runtime-configs.tar.gz: openclaw.json + auth-profiles.json +
#    auth-state.json + models.json + sessions.json + HEARTBEAT.md +
#    devices/ + identity/ + docker-compose.yml + .env for Gus and
#    every tenant. Closes the 2026-05-22 gap where Julian's runtime
#    fixes were not in any offsite backup.

set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

BACKUP_ROOT="/home/tagai/.openclaw/backups"
SOURCE_HINDSIGHT="/home/tagai/.openclaw/hindsight"
SOURCE_DB="/home/tagai/.openclaw/memory/main.sqlite"
TEMPLATE_DIR="/home/tagai/openclaw-bootstrap/_template"
TENANTS_ROOT="/home/tagai/tenants"
LOG="$BACKUP_ROOT/backup.log"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET_TMP="$BACKUP_ROOT/.backup-$STAMP.tmp"
TARGET_FINAL="$BACKUP_ROOT/backup-$STAMP"

log() {
  echo "[$(date -Is)] $*" | tee -a "$LOG"
}

cleanup_on_error() {
  rc=$?
  log "FAILED (rc=$rc) — cleaning up tmp"
  rm -rf "$TARGET_TMP"
  exit $rc
}
trap cleanup_on_error ERR

log "===== START backup-$STAMP ====="

if [ -d "$TARGET_FINAL" ]; then
  log "Already have $TARGET_FINAL — idempotent skip"
  exit 0
fi

for src in "$SOURCE_HINDSIGHT" "$SOURCE_DB"; do
  if [ ! -e "$src" ]; then
    log "Source missing: $src"
    exit 2
  fi
done

mkdir -p "$TARGET_TMP"
chmod 700 "$TARGET_TMP"

# 1. hindsight/
log "Snapshotting hindsight/ -> tar.gz"
tar -czf "$TARGET_TMP/hindsight.tar.gz" -C /home/tagai/.openclaw hindsight
HINDSIGHT_BYTES=$(stat -c%s "$TARGET_TMP/hindsight.tar.gz")
log "  hindsight.tar.gz: $HINDSIGHT_BYTES bytes"

# 2. bootstrap _template/
TPL_BYTES=0
if [ -d "$TEMPLATE_DIR" ]; then
  log "Snapshotting openclaw-bootstrap/_template/ -> tar.gz"
  tar -czf "$TARGET_TMP/bootstrap-template.tar.gz" -C /home/tagai/openclaw-bootstrap _template
  TPL_BYTES=$(stat -c%s "$TARGET_TMP/bootstrap-template.tar.gz")
  log "  bootstrap-template.tar.gz: $TPL_BYTES bytes"
fi

# 3. runtime-configs (Gus + per-tenant). Cherry-picked small files only.
log "Snapshotting runtime-configs (Gus + tenants) -> tar.gz"
CFG_STAGE="$TARGET_TMP/.cfg-stage"
mkdir -p "$CFG_STAGE/gus/.openclaw" "$CFG_STAGE/tenants"

# Gus's runtime configs (~/.openclaw/)
for f in /home/tagai/.openclaw/openclaw.json /home/tagai/.openclaw/exec-approvals.json /home/tagai/.openclaw/loops.json; do
  [ -f "$f" ] && cp "$f" "$CFG_STAGE/gus/.openclaw/$(basename $f)"
done
if [ -d /home/tagai/.openclaw/agents ]; then
  rsync -a --quiet \
    --include='*/' \
    --include='auth-profiles.json' \
    --include='auth-state.json' \
    --include='models.json' \
    --include='sessions.json' \
    --exclude='*' \
    /home/tagai/.openclaw/agents/ "$CFG_STAGE/gus/.openclaw/agents/"
fi
[ -d /home/tagai/.openclaw/devices  ] && cp -r /home/tagai/.openclaw/devices  "$CFG_STAGE/gus/.openclaw/devices"
[ -d /home/tagai/.openclaw/identity ] && cp -r /home/tagai/.openclaw/identity "$CFG_STAGE/gus/.openclaw/identity"

# Per-tenant runtime configs
if [ -d "$TENANTS_ROOT" ]; then
  for td in "$TENANTS_ROOT"/*/; do
    tid=$(basename "$td")
    if [ -d "$td/.openclaw" ]; then
      mkdir -p "$CFG_STAGE/tenants/$tid/.openclaw"
      for f in "$td/.openclaw/openclaw.json" "$td/.openclaw/exec-approvals.json" "$td/.openclaw/loops.json"; do
        [ -f "$f" ] && cp "$f" "$CFG_STAGE/tenants/$tid/.openclaw/$(basename $f)"
      done
      if [ -d "$td/.openclaw/agents" ]; then
        rsync -a --quiet \
          --include='*/' \
          --include='auth-profiles.json' \
          --include='auth-state.json' \
          --include='models.json' \
          --include='sessions.json' \
          --exclude='*' \
          "$td/.openclaw/agents/" "$CFG_STAGE/tenants/$tid/.openclaw/agents/"
      fi
      [ -d "$td/.openclaw/devices"  ] && cp -r "$td/.openclaw/devices"  "$CFG_STAGE/tenants/$tid/.openclaw/devices"
      [ -d "$td/.openclaw/identity" ] && cp -r "$td/.openclaw/identity" "$CFG_STAGE/tenants/$tid/.openclaw/identity"
      # Workspace top-level small files (HEARTBEAT.md, etc.)
      if [ -d "$td/workspace" ]; then
        mkdir -p "$CFG_STAGE/tenants/$tid/workspace"
        find "$td/workspace" -maxdepth 1 -type f \( -name '*.md' -o -name '*.json' \) -size -1M \
          -exec cp {} "$CFG_STAGE/tenants/$tid/workspace/" \;
      fi
      # Compose + per-tenant env (env is sensitive but encrypted in the age blob)
      [ -f "$td/openclaw/docker-compose.yml" ] && {
        mkdir -p "$CFG_STAGE/tenants/$tid/openclaw"
        cp "$td/openclaw/docker-compose.yml" "$CFG_STAGE/tenants/$tid/openclaw/"
      }
      [ -f "$td/openclaw/.env" ] && cp "$td/openclaw/.env" "$CFG_STAGE/tenants/$tid/openclaw/.env"
    fi
  done
fi

# Shared envs (CRITICAL — without these nothing works on restore)
[ -f /home/tagai/.openclaw-shared.env ] && cp /home/tagai/.openclaw-shared.env "$CFG_STAGE/"
[ -f /home/tagai/.tagai-env           ] && cp /home/tagai/.tagai-env           "$CFG_STAGE/"

tar -czf "$TARGET_TMP/runtime-configs.tar.gz" -C "$CFG_STAGE" .
CFG_BYTES=$(stat -c%s "$TARGET_TMP/runtime-configs.tar.gz")
rm -rf "$CFG_STAGE"
log "  runtime-configs.tar.gz: $CFG_BYTES bytes"

# 4. memory.sqlite (WAL-safe)
log "Hot-backup memory/main.sqlite via Python sqlite3 API"
python3 - <<PYEOF
import sqlite3, os
src = "$SOURCE_DB"
dst = "$TARGET_TMP/memory.sqlite"
s = sqlite3.connect(src); d = sqlite3.connect(dst)
s.backup(d); s.close(); d.close()
print(f"  memory.sqlite: {os.path.getsize(dst)} bytes (WAL-consistent snapshot)")
PYEOF
DB_BYTES=$(stat -c%s "$TARGET_TMP/memory.sqlite")

# 5. memory/*.md companions
log "Including memory/*.md companions"
shopt -s nullglob
for f in /home/tagai/.openclaw/memory/*.md; do
  cp "$f" "$TARGET_TMP/$(basename "$f")"
done
shopt -u nullglob

# 6. MANIFEST
log "Writing MANIFEST.txt"
{
  echo "# Backup manifest -- backup-$STAMP"
  echo "# Host: $(hostname)  User: $(whoami)  Created: $(date -Is)"
  echo
  echo "Files in this backup:"
  cd "$TARGET_TMP"
  for f in *; do
    if [ -f "$f" ]; then
      printf '  %-32s %14s bytes  sha256=%s\n' "$f" "$(stat -c%s "$f")" "$(sha256sum "$f" | cut -d' ' -f1)"
    fi
  done
  echo
  echo "NOT INCLUDED (recoverable from other sources):"
  echo "  shared-projects/      -> reclone rescue-websites + awesome-design-md from their own GitHub repos"
  echo "  node_modules/         -> reproducible via package manager"
  echo "  session trajectories  -> debug logs, archived locally on disk only"
} > "$TARGET_TMP/MANIFEST.txt"

mv "$TARGET_TMP" "$TARGET_FINAL"
chmod 700 "$TARGET_FINAL"
log "Backup ready: $TARGET_FINAL"
log "  hindsight: $HINDSIGHT_BYTES  bootstrap-template: $TPL_BYTES  runtime-configs: $CFG_BYTES  memory.sqlite: $DB_BYTES"

# Retention sweep
log "Retention sweep -- deleting backups older than 7 days"
DELETED=0
while IFS= read -r dir; do
  rm -rf "$dir"
  DELETED=$((DELETED + 1))
  log "  deleted: $(basename "$dir")"
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'backup-*' -mtime +7 -print 2>/dev/null)
log "  retention: deleted $DELETED old backup dir(s)"

TOTAL_BACKUPS=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'backup-*' | wc -l)
TOTAL_BYTES=$(du -sb "$BACKUP_ROOT" 2>/dev/null | cut -f1)
log "===== END backup-$STAMP -- total backups: $TOTAL_BACKUPS, total backup-root: $TOTAL_BYTES bytes ====="
