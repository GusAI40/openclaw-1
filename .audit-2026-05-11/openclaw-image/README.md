# OpenClaw Image — Grammy Patch (durability artifact)

## What

`Dockerfile.grammy` is the patch that adds the [Grammy](https://grammy.dev/) Telegram
framework to the upstream openclaw image. Without it, the Telegram-alert layer (used by
Hermes + jarvis-vapi + multi-platform skill) silently fails at runtime — `require('grammy')`
throws.

## Why this exists (forensic context)

Discovered by the 2026-05-11 audit: the running `openclaw:tagai` image was built ad-hoc
from a single 308-byte Dockerfile in `/home/tagai/openclaw-grammy-patch/` on the VPS. That
file was **not in any git repo**. A clean rebuild (or disk wipe + restore) would have
silently dropped Grammy. Telegram alerts had broken once already (May 7 incident) for
exactly this reason. See `../drift/DRIFT.json` → `openclaw_image_drift`.

## Build + tag

```bash
# On the docker host (currently tagai-cloud), ensure the upstream base is present:
docker pull openclaw/openclaw:2026.5.6
docker tag openclaw/openclaw:2026.5.6 openclaw:tagai-pre-grammy

# Build the patched image:
docker build -f Dockerfile.grammy -t openclaw:tagai-grammy .

# Tag for production use (this is the tag referenced by /home/tagai/openclaw/.env):
docker tag openclaw:tagai-grammy openclaw:tagai

# Verify Grammy is in place:
docker run --rm openclaw:tagai sh -c \
  'ls /app/node_modules/grammy/package.json && node -e "console.log(require(\"/app/node_modules/grammy/package.json\").version)"'
```

## Recreate the running container with the new image

```bash
cd /home/tagai/openclaw
docker compose up -d --force-recreate openclaw-gateway

# Wait for healthy:
for i in {1..20}; do
  H=$(docker inspect openclaw-openclaw-gateway-1 --format '{{.State.Health.Status}}')
  echo "  $i: $H"
  [ "$H" = "healthy" ] && break
  sleep 4
done

# Verify no openclaw.json clobber:
ls /home/tagai/.openclaw/openclaw.json.clobbered.* 2>/dev/null | wc -l
```

## Upgrading openclaw to a new upstream version

When openclaw releases a new version (e.g. 2026.6.0), do:

```bash
# 1. Bump meta.lastTouchedVersion in openclaw.json BEFORE pulling, to prevent the clobber:
python3 -c "
import json
p='/home/tagai/.openclaw/openclaw.json'
cp=p+'.pre-upgrade-'+__import__('datetime').datetime.now().strftime('%Y%m%d-%H%M%S')
import shutil; shutil.copy(p, cp)
d=json.load(open(p))
d['meta']['lastTouchedVersion']='2026.6.0'
d['meta']['lastTouchedAt']=__import__('datetime').datetime.utcnow().isoformat()+'Z'
json.dump(d, open(p,'w'), indent=2)
print('Snapshot:', cp)
"

# 2. Pull the new upstream + rebuild the grammy layer:
docker pull openclaw/openclaw:2026.6.0
docker tag openclaw/openclaw:2026.6.0 openclaw:tagai-pre-grammy
docker build -f Dockerfile.grammy -t openclaw:tagai-grammy .
docker tag openclaw:tagai-grammy openclaw:tagai

# 3. Recreate the container:
cd /home/tagai/openclaw
docker compose up -d --force-recreate openclaw-gateway

# 4. Verify: no new .clobbered file, healthcheck passes, openclaw.json meta.lastTouchedVersion matches new image version.
```

## What was different before this commit

| | Before | After |
|---|---|---|
| Where grammy patch lives | Only on VPS at `/home/tagai/openclaw-grammy-patch/` | In git at `.audit-2026-05-11/openclaw-image/Dockerfile.grammy` |
| Surviving a VPS disk wipe | ❌ patch was lost forever | ✅ rebuild from this dir |
| Documented upgrade procedure | None (the May 7 incident took hours to diagnose) | This README + RUNBOOK.md §2 |
| `:tagai-pre-grammy` provenance | Unknown — somebody ran `docker pull` once and renamed | Documented: `openclaw/openclaw:2026.5.6` → `:tagai-pre-grammy` |

## TODO (not blocking, but ideal)

- [ ] Consider committing Dockerfile.grammy directly to `/home/tagai/openclaw-grammy-patch/` as a git submodule pointed at this repo, so VPS edits stay in sync.
- [ ] Add a `make rebuild-openclaw` target in a future `Makefile` that runs the full sequence.
- [ ] Pin the upstream openclaw version more strictly (currently 2026.5.6 — when we upgrade, this README and `meta.lastTouchedVersion` must move together).
