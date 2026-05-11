# Operational Scripts (Task #14 — Data Durability)

## `backup-agent-memory.sh`

The daily backup script for the two pieces of irreplaceable agent state on the VPS:

| Source | Size (2026-05-11) | What it is |
|---|---|---|
| `/home/tagai/.openclaw/hindsight/` | 233 MB | The Karpathy-style long-term knowledge store. Contains pg0 (Postgres-like) database files. Cannot be regenerated. |
| `/home/tagai/.openclaw/memory/main.sqlite` (+ WAL) | 20 MB | Primary state DB — sessions, kanban, vector chunks (16 tables). Cannot be regenerated. |

### Deployed location

- Canonical: this file in git (`audit-2026-05-11/scripts/backup-agent-memory.sh`)
- Mirrored to: `/home/tagai/.openclaw/backups/backup.sh` on tagai-cloud (mode 700)
- Cron: `0 3 * * *` (daily 3 AM UTC) in tagai's crontab
- Output dir: `/home/tagai/.openclaw/backups/backup-YYYYMMDD-HHMMSS/`
- Log: `/home/tagai/.openclaw/backups/backup.log`
- Retention: 7 days (older `backup-*` dirs auto-deleted)

### Design choices

| Choice | Why |
|---|---|
| `sqlite3.backup()` via Python (not `cp`) | WAL-aware, online-safe. A `cp` of an actively-written SQLite DB risks partial-write corruption. |
| `tar -czf` for hindsight | Hindsight is 5000+ small files; tarring + gzipping reduces inode pressure on the backups dir and gives ~6× compression (233 MB → 39 MB). |
| `umask 077` + `chmod 700` | All backup artifacts are mode 600/700. Defense-in-depth — the .sqlite contains session tokens and conversation history. |
| Atomic tmp → mv rename | The `.backup-*.tmp` dir is mv'd to `backup-*` only after every step succeeds. A failed run leaves only the .tmp, not a half-formed backup. |
| MANIFEST.txt with sha256 | Every file's hash is logged. Future restore can verify integrity without trusting filesystem. |
| `trap cleanup_on_error ERR` | Aborted runs always clean up their tmp dir — no half-formed garbage accumulates. |
| Idempotent timestamp check | Re-running in the same second is a no-op. |
| 7-day retention by `find -mtime +7` | At ~60 MB/day this caps disk usage around 420 MB. |

### Manual test

```bash
ssh tagai@tagai-cloud
/home/tagai/.openclaw/backups/backup.sh   # synchronous, ~6 sec for current sizes
ls /home/tagai/.openclaw/backups/         # see new backup-* dir
cat /home/tagai/.openclaw/backups/backup-*/MANIFEST.txt   # verify file list + hashes
```

### Restore (when you actually need it)

```bash
LATEST=$(ls -dt /home/tagai/.openclaw/backups/backup-* | head -1)

# 1. Stop services that touch the DB
docker compose -f /home/tagai/openclaw/docker-compose.yml down openclaw-gateway

# 2. Verify hashes
sha256sum -c <(awk '/sha256=/{print $5,$1}' "$LATEST/MANIFEST.txt" | sed 's|sha256=||; s|^|/.../|')   # adapt path

# 3. Restore hindsight
tar -xzf "$LATEST/hindsight.tar.gz" -C /home/tagai/.openclaw/

# 4. Restore SQLite (NEVER directly cp over a running DB)
cp "$LATEST/memory.sqlite" /home/tagai/.openclaw/memory/main.sqlite

# 5. Restart
docker compose -f /home/tagai/openclaw/docker-compose.yml up -d openclaw-gateway
```

## TODO — off-site sync (not in this commit)

Local backups protect against accidental deletion or corruption, **not against
disk/host loss.** The Hetzner CPX21 has a single virtual disk; if it dies, both
source and local backup go with it. Future work:

| Option | Cost | Effort |
|---|---|---|
| Hetzner Storage Box (1 TB, ~$3/mo, supports rsync/SSH/SMB) | $3/mo | 30 min — add rsync to backup.sh |
| AWS S3 / Cloudflare R2 (pay-per-GB) | <$1/mo at 60 MB/day | 1 hr — install rclone, configure profile |
| Private GitHub repo via `git push` of MANIFEST + small files | free | 30 min — but GitHub LFS needed for 60 MB tarballs |

Recommendation: **Hetzner Storage Box** — same vendor, lowest network latency, supports plain rsync over SSH. Add to crontab as a separate entry at 3:30 AM so the local backup is done first.
