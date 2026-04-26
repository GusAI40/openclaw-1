# Resource Cleanup — 2026-04-25

## TL;DR
- **Disk freed: ~26 GB (84% → 47%)** — major win
- RAM available: 1.7Gi → 1.6Gi (cleanup does not directly affect RAM without restart)
- Sessions removed: **0** (none older than 14 days; all 11 files are from today)
- Docker prune: container/image prune yielded 0B (nothing dangling); **build cache prune freed 28.12GB**
- Image total: 51.32GB → 25.93GB (intermediate layers freed alongside build cache)

## Actions taken
- [x] Baseline + after measurements captured
- [/] Session cleanup — SKIPPED (0 files older than 14 days; only 11 total session files, all newer than today)
- [x] `docker container prune -f` (0B reclaimed — nothing stopped)
- [x] `docker image prune -f` (0B reclaimed — nothing dangling)
- [x] `docker builder prune -f --filter 'until=168h'` (0B — nothing older than 7 days)
- [x] `docker builder prune -f --filter 'until=24h'` — **28.12GB reclaimed** (highest-leverage action)
- [x] `apt-get clean` via passwordless sudo — completed silently (success)
- [ ] Swap setup — **DEFERRED** (already 4GB swap configured; 800Mi in use, 3.2Gi free — no urgent need)

## Recommended next actions (NOT done by this atom)
- **Swap is already configured (4GB)** — no swap action needed. Discovered at baseline. 800Mi used, 3.2Gi free. Disregard the "Add 2GB swap file" recommendation in the playbook — server is already covered.
- **RAM still tight at 141Mi free / 1.6Gi available** — RAM pressure is real but cleanup does not address it. Long-running containers (5 active) hold the working set. Options: (a) restart non-critical containers to reset their working set, (b) upgrade to CPX31 (8GB RAM) — see `HETZNER_INFRASTRUCTURE.yaml` upgrade triggers.
- **Build cache will rebuild** — next deploy will repopulate ~17GB of cache. Schedule a `docker builder prune --filter 'until=72h'` weekly cron to keep it bounded without hurting incremental builds.
- **Investigate the 25.93GB Docker image footprint** — 6 images for one app is high. Consider multi-stage build optimization or shared base layers.

## Before / After

### Disk
```
BEFORE: /dev/sda1  75G  60G  12G  84% /
AFTER:  /dev/sda1  75G  34G  39G  47% /
DELTA:  -26G used, +27G available
```

### Memory
```
BEFORE:           total   used   free   shared  buff/cache  available
        Mem:      3.7Gi   2.0Gi  1.1Gi  4.8Mi   894Mi       1.7Gi
        Swap:     4.0Gi   800Mi  3.2Gi

AFTER:            total   used   free   shared  buff/cache  available
        Mem:      3.7Gi   2.1Gi  141Mi  4.8Mi   1.8Gi       1.6Gi
        Swap:     4.0Gi   834Mi  3.2Gi
```
Note: `free` mem dropped (1.1Gi → 141Mi) but `buff/cache` rose (894Mi → 1.8Gi). Linux is using the freed disk-space-equivalent buffer cache aggressively. `available` (the meaningful number) stayed stable at ~1.6Gi.

### Sessions
```
BEFORE: 20M  ~/.openclaw/agents/main/sessions/  (11 files, 0 older than 14 days)
AFTER:  20M  ~/.openclaw/agents/main/sessions/  (unchanged — nothing eligible)
```

### Docker
```
BEFORE:
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         3         51.32GB   4.245GB (8%)
Containers      5         5         270.2MB   0B (0%)
Local Volumes   0         0         0B        0B
Build Cache     181       0         45.27GB   36.89GB

AFTER:
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         3         25.93GB   4.245GB (16%)
Containers      5         5         270.2MB   0B (0%)
Local Volumes   0         0         0B        0B
Build Cache     76        0         17.15GB   8.767GB
```

## What was NOT touched
- `/home/tagai/.openclaw/openclaw.json` (config)
- `/home/tagai/.openclaw/credentials/`
- All 11 files in `/home/tagai/.openclaw/agents/main/sessions/` (none old enough)
- `/home/tagai/openclaw/` repo
- 5 running containers (all preserved)
- 3 active Docker images (the openclaw deployment image is intact)
- /etc/fstab and swap configuration (swap was already present)

## Notes / deviations from playbook
1. **Playbook said disk was at 78%** — actual was 84% at baseline. Adjusted accordingly.
2. **Playbook said no swap configured** — actual: 4GB swap already configured (800Mi used). Step 6 deferral was correct decision; in fact, step is fully unnecessary.
3. **Session cleanup was a no-op** — only 11 session files exist, all from today. The 213 stale sessions referenced in the task brief were not present. Likely already cleaned by another process or session count was estimated for a different machine state.
4. **`168h` builder filter reclaimed 0B** — all build cache was less than 7 days old. Used `24h` filter (still safe, preserves yesterday's incremental layers) to reclaim 28.12GB.
5. **APT clean** — succeeded silently via passwordless sudo (`sudo -n` worked).

## Raw outputs (key milestones)

### Container/image prune (0B)
```
===CONTAINER-PRUNE===
Total reclaimed space: 0B
===IMAGE-PRUNE===
Total reclaimed space: 0B
```

### Builder prune --filter until=168h (0B)
```
Total: 0B
```

### Builder prune --filter until=24h (28.12GB — 103 cache entries)
```
Total: 28.12GB
```
(Full list of 103 entries captured in agent log; largest single entries: 2.974GB x3, 2.227GB, 1.713GB x2, 1.715GB x3, 937MB x3, 869.9MB x3, 870MB.)

## SSH calls used
6 of 12 budget (baseline / verify-counts / container+image-prune / builder-168h / builder-24h / apt-clean+after).
