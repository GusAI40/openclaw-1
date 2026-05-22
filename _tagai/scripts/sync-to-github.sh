#!/bin/bash
# Canonical source: _tagai/scripts/sync-to-github.sh in GusAI40/openclaw-1
# Lives on VPS at: /home/tagai/.openclaw/backups/sync-to-github.sh
#
# Encrypts new local backups and pushes them as orphan branches to a private GitHub repo.
#
# Cron (3:30 AM, 30 min after local backup completes):
#   30 3 * * * /home/tagai/.openclaw/backups/sync-to-github.sh
#
# Encryption: age (private key at /home/tagai/.openclaw/backups/.age-key.txt)
# Auth:       SSH key already authorized for GusAI40 on GitHub
# Remote:     git@github.com:GusAI40/tagai-cloud-backups.git
# Topology:   one orphan branch per backup (no shared history = no repo bloat)
# Restore:    git fetch && git checkout backup-XXX && age -d -i .age-key.txt *.age | tar xzv
#
# CHANGES 2026-05-22:
#  - Fails loudly (non-zero exit) when ANY backup exceeds the size cap,
#    so cron job records the run as failed instead of logging "Sync complete"
#    while skipping every file. (Real incident: 3 nights of silent failure
#    on backup-20260520, 21, 22-030001 due to 2.9GB shared-projects.)
#  - The new backup.sh strips shared-projects so this should not recur,
#    but the loud-fail guard stays in case future content blows the cap again.

set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

REPO_URL="git@github.com:GusAI40/tagai-cloud-backups.git"
BACKUP_ROOT="/home/tagai/.openclaw/backups"
AGE_PUB_FILE="$BACKUP_ROOT/.age-public.txt"
STATE="$BACKUP_ROOT/.synced-to-github.txt"
LOG="$BACKUP_ROOT/sync-to-github.log"
SIZE_CAP=99000000   # GitHub soft cap

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }
trap 'log "FAILED rc=$?"; rm -rf "$TMP"; exit 1' ERR

touch "$STATE"
chmod 600 "$STATE"

log "===== START sync-to-github ====="

command -v age >/dev/null || { log "age not installed"; exit 2; }
[ -r "$AGE_PUB_FILE" ] || { log "age public key missing at $AGE_PUB_FILE"; exit 2; }
AGE_RECIPIENT=$(cat "$AGE_PUB_FILE")

SSH_PROBE=$(ssh -T -o ConnectTimeout=8 git@github.com < /dev/null 2>&1 || true)
if ! echo "$SSH_PROBE" | grep -q "successfully authenticated"; then
  log "SSH auth to github.com failed: $SSH_PROBE"
  exit 2
fi

# Find unsynced backups
TO_SYNC=()
while IFS= read -r dir; do
  name=$(basename "$dir")
  if ! grep -Fxq "$name" "$STATE"; then
    TO_SYNC+=("$name")
  fi
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'backup-*' | sort)

if [ ${#TO_SYNC[@]} -eq 0 ]; then
  log "Nothing new to sync (all $(wc -l < $STATE) local backups already pushed)"
  log "===== END sync-to-github ====="
  exit 0
fi

log "Found ${#TO_SYNC[@]} backup(s) to sync: ${TO_SYNC[*]}"

# Track failures: skipped (too big) vs hard-fail (push error)
SKIPPED_TOO_BIG=()
PUSHED_OK=()

for name in "${TO_SYNC[@]}"; do
  TMP="/tmp/sync-github-$$-$name"
  mkdir -p "$TMP"
  chmod 700 "$TMP"

  log "Processing $name"

  TARBALL="$TMP/$name.tar.gz"
  tar -czf "$TARBALL" -C "$BACKUP_ROOT" "$name"
  TAR_SIZE=$(stat -c%s "$TARBALL")
  log "  tarball: $TAR_SIZE bytes"

  ENCRYPTED="$TMP/$name.tar.gz.age"
  age -r "$AGE_RECIPIENT" -o "$ENCRYPTED" "$TARBALL"
  rm "$TARBALL"
  ENC_SIZE=$(stat -c%s "$ENCRYPTED")
  log "  encrypted: $ENC_SIZE bytes"

  if [ $ENC_SIZE -gt $SIZE_CAP ]; then
    log "  X $ENC_SIZE bytes exceeds GitHub $SIZE_CAP soft cap -- SKIPPING; will fail at end"
    SKIPPED_TOO_BIG+=("$name ($ENC_SIZE bytes)")
    rm -rf "$TMP"
    continue
  fi

  CLONE="$TMP/clone"
  if ! git clone --depth 1 "$REPO_URL" "$CLONE" 2>/dev/null; then
    mkdir -p "$CLONE"
    git -C "$CLONE" init -q
    git -C "$CLONE" remote add origin "$REPO_URL"
  fi
  cd "$CLONE"
  git checkout --orphan "$name" 2>/dev/null
  git rm -rf . 2>/dev/null || true
  mv "$ENCRYPTED" "./$name.tar.gz.age"

  cat > MANIFEST.md <<MANIFEST
# Backup: $name

| Field | Value |
|---|---|
| Source host | $(hostname) |
| Encrypted size | $ENC_SIZE bytes |
| age recipient | $AGE_RECIPIENT |
| sha256 | $(sha256sum "$name.tar.gz.age" | cut -d' ' -f1) |
| Created | $(date -Is) |

## Restore

\`\`\`bash
git fetch origin $name
git checkout $name
age -d -i /home/tagai/.openclaw/backups/.age-key.txt $name.tar.gz.age | tar xzv
\`\`\`

Decryption requires the age private key at \`/home/tagai/.openclaw/backups/.age-key.txt\` on the source host.
**If that key is lost, this backup is unrecoverable.** Back it up separately.
MANIFEST

  git -c user.email=tagai@tagai-cloud.hetzner -c user.name=tagai-cloud add "$name.tar.gz.age" MANIFEST.md
  git -c user.email=tagai@tagai-cloud.hetzner -c user.name=tagai-cloud commit -q -m "backup $name ($ENC_SIZE bytes encrypted)"

  if git push origin "$name" 2>&1 | tee -a "$LOG"; then
    echo "$name" >> "$STATE"
    PUSHED_OK+=("$name")
    log "  v pushed origin/$name"
  else
    log "  X push failed for $name"
    rm -rf "$TMP"
    exit 3
  fi

  cd /
  rm -rf "$TMP"
done

# Summary
log "Sync complete. Pushed: ${#PUSHED_OK[@]}  Skipped-too-big: ${#SKIPPED_TOO_BIG[@]}"
if [ ${#PUSHED_OK[@]} -gt 0 ]; then
  log "  pushed: ${PUSHED_OK[*]}"
fi
if [ ${#SKIPPED_TOO_BIG[@]} -gt 0 ]; then
  log "  SKIPPED (TOO BIG): ${SKIPPED_TOO_BIG[*]}"
  log "===== END sync-to-github (FAILED -- some backups skipped) ====="
  exit 4
fi

log "State file has $(wc -l < $STATE) synced backup(s)."
log "===== END sync-to-github ====="
