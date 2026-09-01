# Off-site Backup via GitHub (Task #19) — LIVE

## Status: shipped 2026-05-11

| Component | Where | State |
|---|---|---|
| Script | `/home/tagai/.openclaw/backups/sync-to-github.sh` on tagai-cloud (mode 700) | running |
| Encryption | age v1.1.1 — asymmetric, recipient = age public key | working |
| age private key | `/home/tagai/.openclaw/backups/.age-key.txt` (VPS, mode 400) | ⚠️ MUST BE BACKED UP SEPARATELY |
| age public key | committed at `scripts/age-public-key.txt` (safe — public-key crypto) | versioned |
| Remote repo | `git@github.com:GusAI40/tagai-cloud-backups.git` (PRIVATE) | live, 2 test backups pushed |
| Auth | SSH key `~/.ssh/id_ed25519_github` (already on GusAI40) | working |
| Cron | `30 3 * * * /home/tagai/.openclaw/backups/sync-to-github.sh` | installed |
| Topology | One orphan branch per backup — no shared history, no repo bloat | confirmed |
| State tracking | `/home/tagai/.openclaw/backups/.synced-to-github.txt` | idempotent re-run = no-op |

## ⚠️ CRITICAL — do this NOW, before the next nightly run

The age private key is currently **only on the VPS**. If the VPS disk dies, the key is gone too — and **every encrypted backup on GitHub becomes permanent noise**. The off-site sync is theoretical until you back up the key separately.

**Run this once, paste the output somewhere safe:**

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 cat ~/.openclaw/backups/.age-key.txt
```

Then save the output via one of:

1. **1Password / Bitwarden Secure Note** titled `age key — tagai-cloud backups` (recommended)
2. Print on paper, lock in physical safe (paranoid)
3. Encrypted attachment in a private email to yourself (belt-and-suspenders)

The key is 184 bytes — text, fits anywhere.

## Restore procedure

```bash
# On any machine with git + age installed:
git clone git@github.com:GusAI40/tagai-cloud-backups.git
cd tagai-cloud-backups
git fetch --all
git branch -r | grep backup-          # list available

TARGET=backup-20260511-201423           # pick one
git checkout $TARGET

# Decrypt + extract
age -d -i /path/to/.age-key.txt $TARGET.tar.gz.age | tar xzv

# Now you have: hindsight.tar.gz, memory.sqlite, MANIFEST.txt, *.md
# Restore steps in scripts/README.md → "Restore procedure"
```

## What didn't ship (open follow-ups)

1. **Remote branch pruning** (90-day retention). After ~90 nights you'll have 90 branches. Manual prune: `git push --delete origin backup-YYYYMMDD-HHMMSS`. Or write a weekly `prune-github-backups.sh` that lists branches via `git ls-remote --heads`, parses dates, deletes old ones.
2. **>99 MB encrypted backup handling.** Script aborts (doesn't push) if any encrypted tarball exceeds 99 MB GitHub soft limit. If hindsight grows past ~150 MB raw (~99 MB encrypted), either: switch to git-lfs on the backup repo, OR split hindsight into multiple tarballs, OR move to a real object store.
3. **Off-site for the age key itself.** Per the "CRITICAL" section above — entirely manual.

## Trust model

| Threat | Protected? |
|---|---|
| Hetzner VPS hardware failure | ✅ IF you backed up the age key separately. ❌ if you didn't. |
| `tagai-cloud-backups` repo leaks publicly | ✅ Content is age-encrypted; private key never left the VPS. |
| GusAI40 GitHub account compromised | ⚠️ Adversary can delete branches (no protection). Backups not destroyed-in-place — just inaccessible. |
| VPS root compromised | ❌ Adversary has source AND age key. No backup system protects against compromised source. |

## Verifying the cron actually runs

After the next 3:30 AM UTC tick:

```bash
ssh tagai@tagai-cloud tail -20 /home/tagai/.openclaw/backups/sync-to-github.log
# Should show a "===== START sync-to-github =====" entry timestamped at ~03:30 UTC
# and either "Nothing new to sync" (if local backup didn't run) or per-backup details
```
