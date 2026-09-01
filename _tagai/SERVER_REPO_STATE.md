# Server Repo Reconciliation — 2026-04-26

## TL;DR
**Server is already on `GusAI40/openclaw-1` (our fork) at SHA `9b48e4c0b6` on branch `main`, working tree clean, no `_tagai/` overlay present, no local customizations.** Server's `main` is 3 commits AHEAD of our local clone's stale `main` ref (`978f869fcd`), and is also AHEAD of the local `tagai-main` branch we just pushed (`62d0b2399b`) — meaning our local fork is missing the latest fork commits. Recommendation: **(B-modified)** fetch+pull on server to get latest, then merge `tagai-main` locally with `main` and push.

## Server repo facts
- **Path:** `/home/tagai/openclaw`
- **Remote:** `origin = https://github.com/GusAI40/openclaw-1.git` (fetch + push) — **already our fork, not upstream openclaw/openclaw**
- **Branch:** `main`
- **HEAD SHA:** `9b48e4c0b643a8afa51dc3adb659da757a473864`
- **Last 5 commits:**
  - `9b48e4c0b6` fix(browser): fall back to headless on Linux without display
  - `b5a1b7d44d` fix(google): guard veo video downloads
  - `978f869fcd` fix(google): type veo fallback operation state ← matches our local `main`
  - `94686c63fb` fix(google): fall back to rest for veo sdk 404
  - `814409a3b3` fix(test): keep local Vitest checks serialized
- **Working tree clean?** YES — `git status --short` returned empty
- **Files modified:** none
- **Untracked files:** none
- **Stashes:** 0
- **Reflog evidence:** `HEAD@{0}: clone: from https://github.com/GusAI40/openclaw-1.git` — single fresh clone, no manual edits since
- **Cloned:** Apr 25 16:01 (server time), `.git` last touched Apr 26 17:47

## Deployed image
- **Image:** `openclaw:tagai` (sha256:`1efbe281ae61...`), 4.4GB
- **Containers running:** `openclaw-openclaw-gateway-1` (healthy, 6 min uptime), `openclaw-openclaw-cli-1` (unhealthy, 17h uptime)
- **Built locally:** YES — image tag `:tagai` (not pulled from registry; matches `docker compose build` convention with project name `openclaw`)
- **Compose override:** `docker-compose.override.yml` exists, only adds `env_file: /home/tagai/openclaw/.env` to gateway + cli services. No image overrides, no port changes, no volume mounts beyond default.

## Drift vs local fork
- **Local fork's `main` HEAD (working ref):** `978f869fcd` ← **STALE** (3 commits behind)
- **Local fork's `tagai-main` HEAD:** `62d0b2399b471d6af6ca3c173cf9dcce2c34db2f` (just pushed)
- **GitHub fork's `main` HEAD:** `9b48e4c0b6` ← matches server
- **GitHub fork's `tagai-main` HEAD:** `62d0b2399b` ← matches local
- **Upstream openclaw/openclaw `main` HEAD:** `e672b61417af5c45b0431df6d9109a1f4b618ef5` (different SHA — fork's main has diverged or been rebased)
- **Server vs our overlay:** Server has NO `_tagai/` directory. Our `tagai-main` branch with overlay was pushed but server is on `main`, not `tagai-main`.

### Drift summary table
| Ref | SHA | Notes |
|---|---|---|
| Server `/home/tagai/openclaw` HEAD | `9b48e4c0b6` | On `main`, clean |
| Local `main` | `978f869fcd` | 3 behind GitHub fork's main |
| Local `tagai-main` | `62d0b2399b` | Has `_tagai/` overlay |
| GitHub fork `main` | `9b48e4c0b6` | Server is here |
| GitHub fork `tagai-main` | `62d0b2399b` | Pushed today |
| Upstream `main` | `e672b61417` | Fork has drifted from upstream |

## Recommendation (atomic action)

**Choose (B-modified): server already runs our fork — sync latest + apply overlay via branch switch.**

Two-step plan (NOT executed — read-only task):

1. **Locally** (catch up + integrate overlay):
   ```bash
   cd C:/Users/gsanc/TAG-Projects-2026/openclaw
   git fetch origin
   git checkout main && git pull --ff-only origin main   # 978f869fcd → 9b48e4c0b6
   git checkout tagai-main
   git merge main                                         # bring 3 fork commits into tagai-main
   git push origin tagai-main
   ```

2. **On server** (switch to overlay branch + rebuild):
   ```bash
   ssh tagai-cloud
   cd ~/openclaw
   git fetch origin
   git checkout tagai-main           # gets _tagai/ overlay
   docker compose up -d --build      # rebuild image with overlay applied
   ```

**Justification:** Server's remote is *already* `GusAI40/openclaw-1` — this was not previously documented but reflog confirms it was cloned fresh 24 hours ago. No customizations on server, working tree clean, no local commits to lose. Switching branches from `main` to `tagai-main` is a safe fast-forward operation. Option (A) is wrong because it adds the fork as a *new* remote when it's already `origin`. Option (C) would discard a working deployment for no reason.

## Risks
**LOW.**
- No data loss risk: working tree clean, no stashes, no untracked files, no local commits.
- `.env` file is server-only (19 lines, present at `/home/tagai/openclaw/.env`, content not inspected per constraints). Branch switch will not touch it (gitignored).
- `docker-compose.override.yml` is gitignored or untracked — survives branch switch. **Verify** with `git ls-files docker-compose.override.yml` before switching (1-line precaution).
- Image rebuild will take time (~5-10 min) and cause brief downtime on gateway + cli containers. Schedule accordingly.
- Local `tagai-main` is 3 commits BEHIND the new fork main; merge first locally before pushing or server pull will fail / fast-forward conflict.

## Raw outputs

### Server git state
```
$ git remote -v
origin	https://github.com/GusAI40/openclaw-1.git (fetch)
origin	https://github.com/GusAI40/openclaw-1.git (push)

$ git rev-parse HEAD
9b48e4c0b643a8afa51dc3adb659da757a473864

$ git rev-parse --abbrev-ref HEAD
main

$ git log -5 --oneline
9b48e4c0b6 fix(browser): fall back to headless on Linux without display
b5a1b7d44d fix(google): guard veo video downloads
978f869fcd fix(google): type veo fallback operation state
94686c63fb fix(google): fall back to rest for veo sdk 404
814409a3b3 fix(test): keep local Vitest checks serialized

$ git status --short
(empty)

$ git diff HEAD --stat
(empty)

$ git stash list
(empty)

$ git ls-files --others --exclude-standard
(empty)

$ git reflog | head -1
9b48e4c0b6 HEAD@{0}: clone: from https://github.com/GusAI40/openclaw-1.git

$ find . -maxdepth 2 -name '_tagai' -o -name '.tagai*'
(empty — no overlay on server)
```

### Server docker state
```
$ docker inspect openclaw-openclaw-gateway-1 --format '{{.Image}} | {{.Config.Image}}'
sha256:1efbe281ae6193513d2ec3c9f5e97ed0c2b4772ddb3c38580d3b36315514abe3 | openclaw:tagai

$ docker images | grep -i openclaw
openclaw:tagai     1efbe281ae61    4.4GB

$ docker ps (openclaw filter)
openclaw-openclaw-cli-1     | openclaw:tagai | Up 17 hours (unhealthy)
openclaw-openclaw-gateway-1 | openclaw:tagai | Up 6 minutes (healthy)
```

### Server compose override
```yaml
# /home/tagai/openclaw/docker-compose.override.yml
services:
  openclaw-gateway:
    env_file:
      - /home/tagai/openclaw/.env
  openclaw-cli:
    env_file:
      - /home/tagai/openclaw/.env
```

### Server .env / scripts
```
$ wc -l /home/tagai/openclaw/.env
19 /home/tagai/openclaw/.env

$ ls scripts/ | head -5
AGENTS.md, analyze-plugin-sdk-usage.ts, anthropic-prompt-probe.ts, audit-seams.mjs, auth-monitor.sh, ...
(120+ build/test scripts — all upstream openclaw scripts, no TAG-specific additions)

$ cat docker-setup.sh
#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$ROOT_DIR/scripts/docker/setup.sh"
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Docker setup script not found at $SCRIPT_PATH" >&2
  exit 1
fi
exec "$SCRIPT_PATH" "$@"
```

### Local repo state
```
$ git rev-parse HEAD
62d0b2399b471d6af6ca3c173cf9dcce2c34db2f  (on tagai-main)

$ git rev-parse main
978f869fcdeea4246c1c5ea47bd94c11ebc727fa  (STALE — 3 behind GitHub)

$ git rev-parse tagai-main
62d0b2399b471d6af6ca3c173cf9dcce2c34db2f

$ git remote -v
origin	  https://github.com/GusAI40/openclaw-1.git
upstream  https://github.com/openclaw/openclaw.git

$ git ls-remote origin main
9b48e4c0b643a8afa51dc3adb659da757a473864	refs/heads/main

$ git ls-remote https://github.com/openclaw/openclaw.git main
e672b61417af5c45b0431df6d9109a1f4b618ef5	refs/heads/main
```

### package.json identity
```
"name": "openclaw",
"version": "2026.4.25"
```
