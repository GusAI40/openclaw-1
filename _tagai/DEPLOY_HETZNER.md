# Deploy OpenClaw to Hetzner — Caddy + plain `docker compose`

**Last verified: 2026-04-26.** See `_tagai/HETZNER_PREFLIGHT.md`,
`_tagai/CADDY_AUDIT.md`, `_tagai/CLI_HEALTH_INVESTIGATION.md`,
`_tagai/SERVER_REPO_STATE.md` for the audit trail.

> **This is NOT a Coolify deploy.** Earlier docs assumed Coolify + Traefik.
> The actual server uses Caddy on the host as the reverse proxy, plain
> `docker compose` for containers, and Let's Encrypt via Caddy's automatic
> cert handling. If a future agent says "let's use Coolify here" — they're
> wrong. Read the preflight + audit docs before changing topology.

---

## 1. Current state

| Item | Value |
|---|---|
| Server | `tagai-cloud` (Hetzner CPX21) |
| Public IP | `87.99.148.242` |
| OS | Ubuntu 24.04 (kernel 6.8.0) |
| RAM | 3.7 GiB total, ~3.2 GiB used at idle (no swap) |
| Disk | 75 GiB, 78% used |
| Reverse proxy | Caddy v2.11.2 on host (systemd, NOT a container) |
| Caddyfile | `/etc/caddy/Caddyfile` |
| Container runtime | Docker + plain `docker compose` |
| Repo path on server | `/home/tagai/openclaw/` |
| Repo origin | `https://github.com/GusAI40/openclaw-1.git` (TAG fork) |
| Active branch on server | `main` (consider switching to `tagai-main` to pick up overlay) |
| Image tag | `openclaw:tagai` (built locally on server) |
| Containers | `openclaw-openclaw-gateway-1`, `openclaw-openclaw-cli-1` |
| Gateway port (host) | `18789` (also `18790` for bridge) |
| VAPI webhook port (host) | `18792` (host Node process, not a container) |
| TLS | Let's Encrypt via Caddy automatic ACME |
| DNS | `openclaw.ubntag.com` → `87.99.148.242` (A record live) |
| External health | `https://openclaw.ubntag.com/healthz` returns `{"ok":true,"status":"live"}` |

Deploy is **already live** end-to-end. Most of the time you only need the
Standard Update Flow below. The First-Time Deploy section is only useful if
you ever rebuild from scratch.

---

## 2. Standard update flow (most common)

This is the routine you'll run for almost every code change.

```bash
# On the server
ssh tagai@87.99.148.242
cd /home/tagai/openclaw

# Pull latest from the fork
git fetch origin
git checkout tagai-main          # or `main` if you're not using the overlay branch
git pull --ff-only origin tagai-main

# Rebuild + recreate containers (with the TAG overlay applied)
docker compose \
  -f docker-compose.yml \
  -f _tagai/docker-compose.tagai.yml \
  up -d --build

# Watch the rebuild + healthcheck land
docker compose ps
docker compose logs -f openclaw-gateway
```

Rebuild typically takes 5–10 minutes. Brief downtime on `gateway` and `cli`
during recreate. **Caddy keeps running** — TLS and DNS are unaffected.

If you've never applied the overlay before, the very first time you add
`-f _tagai/docker-compose.tagai.yml` Docker will pick up the
`restart: unless-stopped` and `depends_on` additions for the CLI and rebuild
the dependency graph. Expect the CLI to be recreated. This is fine.

### Without the TAG overlay (legacy path)

If for some reason the `_tagai/` overlay is not yet on this branch, you can
still run with just the upstream compose + the existing
`docker-compose.override.yml` (which only injects `env_file`):

```bash
docker compose up -d --build
```

This is what the server ran from 2026-04-25 through 2026-04-26. It works,
but the CLI orphan-namespace bug (see Section 7) bites every time the
gateway is recreated.

---

## 3. First-time deploy (rare — only when starting fresh)

You almost never need this. Only run if `/home/tagai/openclaw/` is missing
or if you've manually removed everything. The current server is already
provisioned per these steps.

```bash
# 0. Prereqs (already satisfied on tagai-cloud as of 2026-04-26):
#    - Docker + docker compose plugin installed
#    - Caddy v2 installed via apt, systemd-enabled
#    - DNS A record openclaw.ubntag.com -> 87.99.148.242
#    - User `tagai` exists with sudo, in `docker` group

# 1. Clone the fork
sudo -u tagai -i
cd /home/tagai
git clone https://github.com/GusAI40/openclaw-1.git openclaw
cd openclaw
git checkout tagai-main

# 2. Create env file (NEVER commit this)
cat > /home/tagai/openclaw/.env <<'EOF'
OPENCLAW_IMAGE=openclaw:tagai
OPENCLAW_TZ=America/Chicago
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_CONFIG_DIR=/home/tagai/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/tagai/.openclaw/workspace
XDG_CONFIG_HOME=/home/node/.openclaw
EOF
chmod 600 /home/tagai/openclaw/.env

# 3. Ensure `.openclaw` data dir exists (agents/, credentials/, workspace/)
mkdir -p /home/tagai/.openclaw/{agents,credentials,workspace,memory,logs}

# 4. Build + start with the TAG overlay
docker compose \
  -f docker-compose.yml \
  -f _tagai/docker-compose.tagai.yml \
  up -d --build

# 5. Add the Caddy block (see Section 4) and reload Caddy
sudo systemctl reload caddy

# 6. Verify (see Section 5)
curl -fsSL https://openclaw.ubntag.com/healthz
```

---

## 4. Caddyfile reference (READ-ONLY in normal operation)

The Caddy block for `openclaw.ubntag.com` is **already in place**. Do not
modify it unless you're adding a brand-new route. Verbatim from
`/etc/caddy/Caddyfile`:

```caddyfile
# OpenClaw — TAG AI gateway (added 2026-04-25)
openclaw.ubntag.com {
    @vapi path /vapi/webhook /vapi/webhook/* /vapi/tool /vapi/tool/*
    handle @vapi {
        reverse_proxy 127.0.0.1:18792
    }
    handle {
        reverse_proxy localhost:18789
        header {
            Strict-Transport-Security "max-age=31536000; includeSubDomains"
            X-Content-Type-Options "nosniff"
            X-Frame-Options "DENY"
        }
    }
}
```

What it does:

- `/vapi/webhook*` and `/vapi/tool*` go to a host-side Node process on
  `127.0.0.1:18792` (NOT the gateway container — separate VAPI handler).
- Everything else goes to the gateway on `localhost:18789` (the docker-proxy
  port for the gateway container).
- TLS is automatic — Caddy fetches and renews a Let's Encrypt cert for
  `openclaw.ubntag.com` with no manual config.

If you ever need to change it:

```bash
sudo nano /etc/caddy/Caddyfile          # edit
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy             # zero-downtime reload
```

Other domains served by this same Caddy instance (do not break them):
`voiceai.ubntag.com`, `michelle-fb.ubntag.com`,
`michelle-fb-status.ubntag.com`, plus a diagnostic `http://87.99.148.242`
direct-IP route.

---

## 5. Verification

After every deploy, run all three checks:

```bash
# (a) Containers up + healthy
ssh tagai@87.99.148.242 'docker compose -f /home/tagai/openclaw/docker-compose.yml ps'
# Expect:
#   openclaw-openclaw-gateway-1   running (healthy)
#   openclaw-openclaw-cli-1       running (healthy)   # was unhealthy pre-overlay

# (b) Gateway reachable from inside the host
ssh tagai@87.99.148.242 'curl -fsSL http://127.0.0.1:18789/healthz'
# Expect: {"ok":true,"status":"live"}

# (c) Gateway reachable from the public internet via Caddy + TLS
curl -fsSL https://openclaw.ubntag.com/healthz
# Expect: {"ok":true,"status":"live"}
```

If (b) passes but (c) fails, problem is at Caddy/DNS layer — not the deploy.
If (a) fails, problem is in the compose layer — check
`docker compose logs --tail=200 openclaw-gateway`.

---

## 6. Rollback

If a deploy goes bad and you need to revert:

```bash
ssh tagai@87.99.148.242
cd /home/tagai/openclaw

# Find the last-known-good SHA (e.g., from `git log` or a tagged release)
LAST_GOOD_SHA=9b48e4c0b6           # example — substitute the real one

# Hard rollback to that SHA on whichever branch you're on
git fetch origin
git reset --hard "${LAST_GOOD_SHA}"

# Rebuild from the rolled-back tree
docker compose \
  -f docker-compose.yml \
  -f _tagai/docker-compose.tagai.yml \
  up -d --build

# Verify (Section 5)
```

Faster rollback if the bad image is still tagged locally:

```bash
docker compose down
docker tag openclaw:tagai-broken openclaw:tagai-rollback   # safety copy
docker tag openclaw:previous openclaw:tagai                # promote prev image
docker compose up -d
```

You can also flip back to plain upstream by dropping the overlay flag:

```bash
docker compose up -d        # uses only docker-compose.yml + docker-compose.override.yml
```

---

## 7. Common gotchas

### CLI orphan-namespace bug (FIXED by the overlay)

Upstream `docker-compose.yml` declares
`network_mode: service:openclaw-gateway` on `openclaw-cli` but does NOT set
a restart policy. When the gateway is recreated (e.g., via `up -d --build`),
the CLI's network namespace points at the old gateway's container ID and is
orphaned. Healthcheck fails (`ECONNREFUSED 127.0.0.1:18789`), but the CLI
process keeps running in a network-isolated state.

**The TAG overlay (`_tagai/docker-compose.tagai.yml`) fixes this** by adding
`restart: unless-stopped` and `depends_on: condition: service_healthy` on
the CLI service. Always apply the overlay.

If you ever see the CLI in `unhealthy` state after a deploy, manual fix:

```bash
docker compose -f docker-compose.yml -f _tagai/docker-compose.tagai.yml \
  up -d --force-recreate openclaw-cli
```

### RAM pressure (3.7 GiB total, no swap)

This box is one OOM kill away from a bad day. Before any deploy that
introduces a new container or larger image:

```bash
free -h                       # check available RAM
docker stats --no-stream      # check current per-container usage
```

If `available` drops below ~400 MiB, add a swap file BEFORE deploying:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

The TAG overlay pins gateway = 1.5 GiB, cli = 512 MiB, leaving headroom for
the four `michelle-fb-*` containers and Caddy.

### Disk pressure (78% full)

Periodic cleanup:

```bash
docker image prune -af                         # safe — only dangling images
docker system prune -af --volumes              # ONLY if no in-use volumes you care about
journalctl --vacuum-size=200M                  # cap systemd journal
```

### Stale tmux/ssh sessions

`who | wc -l` on this host has shown 200+ "users" — almost all stale ssh
sessions from earlier agent runs. They consume tiny amounts of memory and
clutter `who`. Clean periodically:

```bash
who | awk '{print $2}' | sort -u | xargs -I{} sudo pkill -9 -t {}
```

Don't do this if you're currently SSH'd in — you'll kill yourself.

### Two compose-override files coexisting

Server currently has `/home/tagai/openclaw/docker-compose.override.yml`
(applied automatically by `docker compose up -d`) which only adds
`env_file`. The TAG overlay at `_tagai/docker-compose.tagai.yml` adds
restart policy, memory limits, depends_on, and timezone. They merge cleanly
when both `-f` flags are used in order. You generally want both:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.override.yml \
  -f _tagai/docker-compose.tagai.yml \
  up -d
```

(Note: `docker-compose.override.yml` is loaded automatically by name even
without `-f`, so the explicit form above is equivalent to the simpler
`-f docker-compose.yml -f _tagai/docker-compose.tagai.yml` only when the
override file is also picked up implicitly. Mixing explicit and implicit
override loading is footgun-prone — pick one and stick with it.)

### Don't push to `upstream`

Remote `upstream = openclaw/openclaw` exists. Only push to `origin`
(the TAG fork). See `_tagai/CLAUDE.md` for the full rule list.
