# Phase 4A — Server Now on tagai-main with Overlay — 2026-04-26

## TL;DR
- Server HEAD: `cbf11034a2df96c67c5bba0a0d005c8c56664011` (tagai-main)
- CLI restart policy: `unless-stopped` (was: `no` per upstream default)
- Both containers healthy
- Public healthz: 200 OK — `{"ok":true,"status":"live"}`

## What changed on disk
- `~/openclaw` checked out to `tagai-main` (was on `main` at `9b48e4c0b6`)
- `docker-compose.override.yml` preserved untouched (server-only env_file overlay)
- `_tagai/` directory now present on disk for server-side reference (overlay file + docs)
- Working tree was clean before checkout — no stash/discard needed

## What changed in runtime
Three-file compose stack now active:
```
docker-compose.yml + docker-compose.override.yml + _tagai/docker-compose.tagai.yml
```

CLI container (`openclaw-openclaw-cli-1`):
- `restart: unless-stopped` (overlay added — fixes orphan-namespace bug)
- `depends_on: openclaw-gateway condition: service_healthy` (overlay added)
- Memory limit: 512 MiB hard, 256 MiB soft reservation
- `OPENCLAW_TZ=America/Chicago`, `TZ=America/Chicago`

Gateway container (`openclaw-openclaw-gateway-1`):
- `restart: unless-stopped` (re-asserted by overlay; matches upstream)
- Memory limit: 1536 MiB hard, 1024 MiB soft reservation
- `OPENCLAW_TZ=America/Chicago`, `TZ=America/Chicago`

Both containers were recreated cleanly. CLI waited for gateway health gate before starting (depends_on condition working as designed).

## Evidence

### Step 1 — Pre-checkout snapshot
```
HEAD: 9b48e4c0b643a8afa51dc3adb659da757a473864
Branch: main
Override: docker-compose.override.yml present
Containers: both healthy (CLI from 6 min ago = P3.A recreate; Gateway from 21 hours ago)
```

### Step 2 — Fetch
```
From https://github.com/GusAI40/openclaw-1
 * branch                  tagai-main -> FETCH_HEAD
 * [new branch]            tagai-main -> origin/tagai-main
```

### Step 3 — Overlay safety review
Inspected `_tagai/docker-compose.tagai.yml` from `origin/tagai-main`:
- Only adds: `restart`, `depends_on`, `environment` (TZ vars), `deploy.resources` (memory limits)
- No `image:`, `command:`, `volumes:`, `networks:`, `ports:` overrides
- No conflicts with server's own `docker-compose.override.yml` (which only adds env_file)
- Safe to layer on top.

### Step 4 — Working tree clean
```
$ git status --short
(empty output — completely clean)
```

### Step 5 — Checkout
```
Switched to a new branch 'tagai-main'
branch 'tagai-main' set up to track 'origin/tagai-main'.
HEAD: cbf11034a2df96c67c5bba0a0d005c8c56664011
```

### Step 6 — Compose merge validation
```
$ docker compose -f docker-compose.yml -f docker-compose.override.yml -f _tagai/docker-compose.tagai.yml config --services
openclaw-gateway
openclaw-cli
```

### Step 7 — Up with overlay
```
 Container openclaw-openclaw-gateway-1 Recreate
 Container openclaw-openclaw-gateway-1 Recreated
 Container openclaw-openclaw-cli-1 Recreate
 Container openclaw-openclaw-cli-1 Recreated
 Container openclaw-openclaw-gateway-1 Starting
 Container openclaw-openclaw-gateway-1 Started
 Container openclaw-openclaw-gateway-1 Waiting
 Container openclaw-openclaw-gateway-1 Healthy
 Container openclaw-openclaw-cli-1 Starting
 Container openclaw-openclaw-cli-1 Started
```

### Step 8 — Post-recreate verification (after 25s warmup)
```
NAME                          STATUS
openclaw-openclaw-cli-1       Up 32 seconds (healthy)
openclaw-openclaw-gateway-1   Up About a minute (healthy)

CLI:     unless-stopped | health=healthy
Gateway: unless-stopped | health=healthy
```

### Step 9 — Public smoke test
```
$ curl -s --max-time 8 https://openclaw.ubntag.com/healthz
{"ok":true,"status":"live"}
HTTP=200
```

## Anything aborted or unexpected
Nothing aborted. Everything proceeded as planned. The server's `docker-compose.override.yml` was preserved untouched and continues to inject the env_file. The new overlay merges with it without collision. The CLI orphan-namespace bug is now structurally prevented: any future gateway recreate will trigger automatic CLI restart via `unless-stopped`, and CLI will only start after gateway passes its healthcheck.
