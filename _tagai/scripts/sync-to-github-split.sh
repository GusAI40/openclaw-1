#!/bin/bash
# /home/tagai/.openclaw/backups/sync-to-github-split.sh
# Canonical source: _tagai/scripts/sync-to-github-split.sh in GusAI40/openclaw-1
#
# THIS IS THE SCRIPT THE CRON ACTUALLY USES.
# Cron: 30 3 * * * /home/tagai/.openclaw/backups/sync-to-github-split.sh >/dev/null 2>&1
#
# Same job as sync-to-github.sh but SPLITS encrypted backups into <90MB chunks
# so GitHub's ~100MB per-file hard cap never causes silent skips. This script
# was added in an earlier session (before 2026-05-22) but had never been
# committed to the repo — this commit closes that gap.
#
# Encryption: age (private key /home/tagai/.openclaw/backups/.age-key.txt)
# Auth:       SSH key already authorized for GusAI40 on GitHub
# Remote:     git@github.com:GusAI40/tagai-cloud-backups.git
# Topology:   one orphan branch per backup; backup stored as N chunk files.
# Restore:    git checkout backup-XXX && cat *.age.part-* > b.tar.gz.age \
#             && age -d -i .age-key.txt b.tar.gz.age | tar xzv
#
# Known historical failure mode (2026-05-20..22 nightly cron):
#   The 2.9 GB shared-projects.tar.gz tier produced ~32 × 90 MB chunks per
#   nightly backup. Single git push of all 32 chunks repeatedly timed out
#   ("Connection to github.com closed by remote host"). Each night's cron
#   exited non-zero (push failed) and was recorded as failed — NOT a silent
#   skip. Fixed 2026-05-22 by removing shared-projects from backup.sh; the
#   new backup tier is ~82 MB (single chunk), which pushes in ~5 seconds.

set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

REPO_URL="git@github.com:GusAI40/tagai-cloud-backups.git"
BACKUP_ROOT="/home/tagai/.openclaw/backups"
AGE_PUB_FILE="$BACKUP_ROOT/.age-public.txt"
STATE="$BACKUP_ROOT/.synced-to-github.txt"
LOG="$BACKUP_ROOT/sync-to-github.log"
CHUNK="90m"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }
TMP=""
trap 'log "FAILED rc=$?"; [ -n "$TMP" ] && rm -rf "$TMP"; exit 1' ERR

touch "$STATE"; chmod 600 "$STATE"
log "===== START sync-to-github-split ====="

command -v age >/dev/null || { log "age not installed"; exit 2; }
command -v split >/dev/null || { log "split not installed"; exit 2; }
[ -r "$AGE_PUB_FILE" ] || { log "age public key missing at $AGE_PUB_FILE"; exit 2; }
AGE_RECIPIENT=$(cat "$AGE_PUB_FILE")

SSH_PROBE=$(ssh -T -o ConnectTimeout=8 git@github.com < /dev/null 2>&1 || true)
if ! echo "$SSH_PROBE" | grep -q "successfully authenticated"; then
  log "SSH auth to github.com failed: $SSH_PROBE"; exit 2
fi

TO_SYNC=()
while IFS= read -r dir; do
  name=$(basename "$dir")
  grep -Fxq "$name" "$STATE" || TO_SYNC+=("$name")
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'backup-*' | sort)

if [ ${#TO_SYNC[@]} -eq 0 ]; then
  log "Nothing new to sync (all $(wc -l < "$STATE") local backups already pushed)"
  log "===== END sync-to-github-split ====="; exit 0
fi
log "Found ${#TO_SYNC[@]} backup(s) to sync: ${TO_SYNC[*]}"

for name in "${TO_SYNC[@]}"; do
  TMP="/tmp/sync-split-$$-$name"
  mkdir -p "$TMP"; chmod 700 "$TMP"
  log "Processing $name"

  TARBALL="$TMP/$name.tar.gz"
  tar -czf "$TARBALL" -C "$BACKUP_ROOT" "$name"
  log "  tarball: $(stat -c%s "$TARBALL") bytes"

  ENCRYPTED="$TMP/$name.tar.gz.age"
  age -r "$AGE_RECIPIENT" -o "$ENCRYPTED" "$TARBALL"
  rm "$TARBALL"
  ENC_SIZE=$(stat -c%s "$ENCRYPTED")
  FULL_SHA=$(sha256sum "$ENCRYPTED" | cut -d' ' -f1)
  log "  encrypted: $ENC_SIZE bytes sha256=$FULL_SHA"

  # Split into <90MB chunks so each file is well under GitHub's 100MB hard cap
  split -b "$CHUNK" -d -a 3 "$ENCRYPTED" "$ENCRYPTED.part-"
  rm "$ENCRYPTED"
  NPARTS=$(find "$TMP" -name "$name.tar.gz.age.part-*" | wc -l)
  log "  split into $NPARTS chunk(s) @ $CHUNK"

  CLONE="$TMP/clone"
  if ! git clone --depth 1 "$REPO_URL" "$CLONE" 2>/dev/null; then
    mkdir -p "$CLONE"; git -C "$CLONE" init -q
    git -C "$CLONE" remote add origin "$REPO_URL"
  fi
  cd "$CLONE"
  git checkout --orphan "$name" 2>/dev/null
  git rm -rf . 2>/dev/null || true
  mv "$TMP/$name.tar.gz.age.part-"* ./

  {
    echo "# Backup: $name"
    echo
    echo "| Field | Value |"
    echo "|---|---|"
    echo "| Source host | $(hostname) |"
    echo "| Encrypted size | $ENC_SIZE bytes |"
    echo "| Chunks | $NPARTS @ $CHUNK |"
    echo "| age recipient | $AGE_RECIPIENT |"
    echo "| sha256 (reassembled .age) | $FULL_SHA |"
    echo "| Created | $(date -Is) |"
    echo
    echo "## Restore"
    echo
    echo '```bash'
    echo "git fetch origin $name && git checkout $name"
    echo "cat $name.tar.gz.age.part-* > $name.tar.gz.age"
    echo "echo '$FULL_SHA  $name.tar.gz.age' | sha256sum -c   # must say OK"
    echo "age -d -i /home/tagai/.openclaw/backups/.age-key.txt $name.tar.gz.age | tar xzv"
    echo '```'
    echo
    echo "Decryption requires the age private key at \`/home/tagai/.openclaw/backups/.age-key.txt\`."
    echo "**If that key is lost, this backup is unrecoverable.** Keep an off-box copy."
  } > MANIFEST.md

  git -c user.email=tagai@tagai-cloud.hetzner -c user.name=tagai-cloud add ./*.part-* MANIFEST.md
  git -c user.email=tagai@tagai-cloud.hetzner -c user.name=tagai-cloud commit -q -m "backup $name ($ENC_SIZE bytes, $NPARTS chunks)"

  if git push origin "$name" 2>&1 | tee -a "$LOG"; then
    echo "$name" >> "$STATE"
    log "  pushed origin/$name ($NPARTS chunks)"
  else
    log "  push failed for $name"; rm -rf "$TMP"; exit 3
  fi
  cd /; rm -rf "$TMP"; TMP=""
done

log "Sync complete. State file has $(wc -l < "$STATE") synced backup(s)."
log "===== END sync-to-github-split ====="
