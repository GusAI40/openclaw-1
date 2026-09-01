# TAG AI / OpenClaw VPS Runbook

> Operational playbook for `tagai-cloud` (87.99.148.242). Written so a junior engineer or Julian can follow it without paging Gus.
> Derived from the 2026-05-11 audit (`.audit-2026-05-11/`).
> Every procedure cites its source file. Every command is copy-paste runnable from PowerShell or bash.

---

## Table of contents

- [Section 0 — Cold-start primer](#section-0--cold-start-primer)
- [Section 1 — Daily health checks (5-minute walkthrough)](#section-1--daily-health-checks-5-minute-walkthrough)
- [Section 2 — Safe openclaw image upgrade (the BIG one)](#section-2--safe-openclaw-image-upgrade-the-big-one)
- [Section 3 — Add a new tenant](#section-3--add-a-new-tenant)
- [Section 4 — Rotate a leaked credential](#section-4--rotate-a-leaked-credential)
- [Section 5 — Handle gateway crash-loop (5xx, 502, 1006, ERR_INVALID_RESPONSE)](#section-5--handle-gateway-crash-loop)
- [Section 6 — Fix the 4 critical hygiene issues we found](#section-6--fix-the-4-critical-hygiene-issues-we-found)
- [Section 7 — Backups](#section-7--backups)
- [Section 8 — Scaling to 100 tenants](#section-8--scaling-to-100-tenants)
- [Section 9 — The escalation ladder](#section-9--the-escalation-ladder)
- [Section 10 — Glossary](#section-10--glossary)

---

## Section 0 — Cold-start primer

### Host

| Field | Value |
| --- | --- |
| Provider | Hetzner |
| Plan | CPX21 (4 vCPU, 8GB RAM, ~$10/mo) |
| Hostname | `tagai-cloud` |
| IPv4 | `87.99.148.242` |
| Disk used | ~29% as of 2026-05-11 |
| Domain | `ubntag.com` (Cloudflare-proxied to the VPS) |

Source: `services/SERVICES.json#vps`.

### SSH access

```powershell
ssh -i $env:USERPROFILE\.ssh\id_hetzner tagai@87.99.148.242
```

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
```

The `tagai` user (UID 1000) owns everything that matters. `root` is reserved for systemd/PM2 and OS upgrades.

### The five files you must know

1. **`/home/tagai/.openclaw/openclaw.json`** — the OpenClaw gateway config (agents, channels, MCPs, plugins). The single most destructible file on the box. See [Section 2](#section-2--safe-openclaw-image-upgrade-the-big-one).
2. **`/home/tagai/.tagai-env`** — master env for the `tagai` shell (29 vars). Sourced by login + systemd user units. Source: `services/SECRETS.json#master_env_files[0]`.
3. **`/home/tagai/.openclaw/.env`** — master env mounted INTO the gateway container as `/home/node/.openclaw/.env` (36 vars). Source: `services/SECRETS.json#master_env_files[1]`.
4. **`/home/tagai/openclaw/docker-compose.yml`** (+ `.override.yml`) — declares the gateway + CLI sidecar.
5. **`/etc/caddy/Caddyfile`** — TLS-terminating reverse proxy. Snapshot at `vps-snapshot/Caddyfile.vps`.

### Quick health (60 seconds)

```bash
# External — does the world see us?
curl -i https://openclaw.ubntag.com/ | head -5
curl -i https://cma.ubntag.com/ | head -5
curl -i https://voiceai.ubntag.com/ | head -5

# Internal (on the VPS) — is the gateway alive?
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 "curl -fsS http://127.0.0.1:18789/healthz"
```

A `502 Bad Gateway` from outside almost always means the gateway died inside the box. Jump to [Section 5](#section-5--handle-gateway-crash-loop).

### The mental model

```
Internet -> Cloudflare -> Caddy (:80/:443) -> upstream services
                                              -> :18789  openclaw-gateway   (docker)
                                              -> :18792  jarvis-vapi-webhook (systemd, /vapi/*)
                                              -> :8080   michelle-cma        (docker)
                                              -> :3000   voiceai-server     (pm2)
                                              -> :8000   michelle-fb       (DEAD)
                                              -> :8001   tour-book        (BROKEN — not host-bound)
```

Source: `services/ROUTES.json` + `services/SERVICES.json#listening_ports_summary`.

---

## Section 1 — Daily health checks (5-minute walkthrough)

Run these every morning. Anything red goes to [Section 9 — escalation ladder](#section-9--the-escalation-ladder).

### 1.1 Are the 6 services running?

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 'bash -s' <<'EOF'
echo "=== Docker ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo
echo "=== Systemd: jarvis-vapi ==="
systemctl is-active jarvis-vapi-webhook.service
echo
echo "=== PM2 (root): voiceai-server ==="
sudo -n pm2 list 2>/dev/null | grep -E "voiceai|name"
echo
echo "=== Caddy ==="
systemctl is-active caddy
EOF
```

Expected:

| Service | Runtime | Expected state |
| --- | --- | --- |
| `openclaw-openclaw-gateway-1` | docker | `Up X (healthy)` |
| `openclaw-openclaw-cli-1` | docker | `Exited (0)` — this is **normal**, it's an on-demand sidecar (per `services/SERVICES.json#exited_containers`) |
| `michelle-cma` | docker | `Up X (healthy)` |
| `tour-book` | docker | `Up X (healthy)` |
| `jarvis-vapi-webhook.service` | systemd | `active` |
| `voiceai-server` (pm2 id 0) | pm2 | `online` |
| `caddy` | systemd | `active` |

### 1.2 Do the Caddy routes return 200?

```bash
for host in openclaw.ubntag.com cma.ubntag.com voiceai.ubntag.com; do
  printf "%-30s " "$host"
  curl -s -o /dev/null -w "%{http_code}\n" "https://$host/"
done
```

`200` or `401`/`403` is fine (auth-protected). `502` = upstream dead. `530` / `526` = Cloudflare can't reach Caddy.

> Note: `michelle-fb.ubntag.com` and `michelle-fb-status.ubntag.com` will return `502` — **these are known broken**, see [Section 6](#section-6--fix-the-4-critical-hygiene-issues-we-found).

### 1.3 Tail recent gateway logs for errors

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 \
  "docker logs --tail 100 openclaw-openclaw-gateway-1 2>&1 | grep -iE 'error|fail|clobber|crash' | tail -20"
```

If you see `clobber`, **STOP** and read [Section 2](#section-2--safe-openclaw-image-upgrade-the-big-one) before doing anything else.

### 1.4 Verify openclaw.json hasn't been clobbered overnight

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 \
  "ls -la /home/tagai/.openclaw/openclaw.json* | grep -i clobbered | tail -5"
```

The newest `.clobbered.*` file should be from **2026-05-06** (the last incident). Anything newer = a clobber happened in the wild. Restore from `openclaw.json.last-good` immediately (commands in [Section 5](#section-5--handle-gateway-crash-loop)).

Source for the clobber forensics: `drift/SCHEMA-RISK.json#incident_log`.

### 1.5 Disk + memory at a glance

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 'df -h / && echo && free -h'
```

`/` >85% used or `Mem available` <500MB = page Gus.

---

## Section 2 — Safe openclaw image upgrade (the BIG one)

> This is the most dangerous routine procedure on the box. Read it twice before running it.
> Source: `drift/SCHEMA-RISK.json` (entire file).

### Why this is dangerous

The OpenClaw gateway reads `/home/node/.openclaw/openclaw.json` on every boot. It checks `meta.lastTouchedVersion`. **If that string does not exactly match the runtime version in the image's `package.json`**, the runtime:

1. Moves the existing config to `openclaw.json.clobbered.<ISO8601>`.
2. Writes fresh defaults to `openclaw.json`.
3. The defaults have NO agents, NO channels, NO plugins, NO MCP servers — every customization is gone.

Once cleared, the only recovery is to re-edit by hand or `cp` from a recent backup.

### What happened on 2026-05-02 to 2026-05-06 (so you know this is real)

`drift/SCHEMA-RISK.json#incident_log` records **six** `.clobbered.*` files in that window. All six snapshot the same `meta.lastTouchedVersion=2026.4.27` config. The pattern was:

1. Image upgraded May 1 night (no version bump on config).
2. Container restarted -> clobber #1 at `2026-05-02T00:05:58Z`.
3. Gus saw the breakage, restored the old config from `.clobbered.*`.
4. Container auto-restarted within 20 seconds -> clobber #2 at `2026-05-02T00:06:18Z`.
5. Quiet for 4 days while a working config was rebuilt by hand.
6. May 6 11:12 -> clobber #3 (config rebuilt but version string still `2026.4.27`).
7. ...4 more clobbers through May 6 11:27 as more restore attempts each kept `2026.4.27`.
8. Final fix: someone manually edited `meta.lastTouchedVersion` to `2026.5.6`. Loop broke.

**The lesson: bump the version string in the config FIRST, then start the container.**

### The 10-step safe upgrade procedure

> Replace `<newtag>` with the actual new image tag (e.g., `openclaw:2026.6.1`).

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242

# STEP 0 — stop the container first. Do NOT just `docker pull` then restart.
cd /home/tagai/openclaw
docker compose stop openclaw-gateway

# STEP 1 — snapshot the current good config
cp /home/tagai/.openclaw/openclaw.json \
   /home/tagai/.openclaw/openclaw.json.pre-upgrade-$(date -u +%Y%m%dT%H%M%SZ)

# STEP 2 — snapshot the persistent state dirs that matter
tar czf /home/tagai/openclaw-backup-$(date -u +%Y%m%d).tar.gz \
  /home/tagai/.openclaw/memory \
  /home/tagai/.openclaw/credentials \
  /home/tagai/.openclaw/identity \
  /home/tagai/.openclaw/secrets \
  /home/tagai/.openclaw/hindsight

# STEP 3 — pull the new image
docker pull openclaw:<newtag>

# STEP 4 — discover the new runtime version BEFORE starting it
NEW_VERSION=$(docker run --rm --entrypoint=node openclaw:<newtag> \
  -e 'console.log(require("/home/node/package.json").version)')
echo "New runtime version: $NEW_VERSION"

# STEP 5 — pre-emptively rewrite meta.lastTouchedVersion in the LIVE config
python3 -c "
import json
p='/home/tagai/.openclaw/openclaw.json'
d=json.load(open(p))
d['meta']['lastTouchedVersion']='$NEW_VERSION'
json.dump(d, open(p,'w'), indent=2)
print('lastTouchedVersion now:', d['meta']['lastTouchedVersion'])
"

# STEP 6 — start the container
cd /home/tagai/openclaw
docker compose up -d

# STEP 7 — verify the gateway is healthy
sleep 8
curl -fsS http://127.0.0.1:18789/healthz && echo "  <- gateway OK"

# STEP 8 — confirm no NEW .clobbered file appeared
ls -la /home/tagai/.openclaw/openclaw.json.clobbered.* | tail -3
# Newest should still be 2026-05-06; anything later = clobber happened

# STEP 9 — IF a clobber happened, roll back
# docker compose down
# cp /home/tagai/.openclaw/openclaw.json.pre-upgrade-* /home/tagai/.openclaw/openclaw.json
# docker pull openclaw:<oldtag>
# docker compose up -d

# STEP 10 — if clobber persists after rollback, the new image added a new REQUIRED top-level key.
# Read the new image's CHANGELOG, merge the new field into the snapshot, retry.
```

Source: `drift/SCHEMA-RISK.json#safe_upgrade_procedure` (verbatim — this is the canonical procedure).

### Preventive hardening (do these BEFORE the next upgrade)

Per `drift/SCHEMA-RISK.json#preventive_hardening_recommendations`:

1. **Pin the image tag** in `/home/tagai/openclaw/.env` to a real version (e.g., `OPENCLAW_IMAGE=openclaw:2026.5.6`). Never `:tagai` or `:latest` in prod.
2. **Wire the daily snapshot cron** (see [Section 7](#section-7--backups)):
   ```cron
   0 3 * * * cp /home/tagai/.openclaw/openclaw.json /home/tagai/.openclaw/backups/openclaw.json.$(date -u +\%Y\%m\%d).json
   ```
3. **Git-track the config**:
   ```bash
   cd /home/tagai/.openclaw && git init && git add openclaw.json && git commit -m "snapshot $(date -u +%Y-%m-%d)"
   ```
4. **Add a clobber monitor** that pages if `openclaw.json.clobbered.*` files appear in the last 24h.

---

## Section 3 — Add a new tenant

> The `bootstrap-tenant/bootstrap-tenant.sh` script (under `.audit-2026-05-11/bootstrap-tenant/`) is the planned single-command tenant provisioner produced by the templater atom. This section describes the operator workflow that script automates and the manual fallback when the script isn't ready.

Source: `hermes-swarm/HERMES.json#replication_implications` and `services/ROUTES.json` for the Caddy template.

### Step 3.1 — DNS setup

In Cloudflare for `ubntag.com`:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `<tenant>` | `tagai-cloud.ubntag.com` (or the apex A record) | proxied (orange cloud) is fine |

Caddy works behind Cloudflare's proxy because `trusted_proxies cloudflare` is set in the Caddyfile (see `vps-snapshot/Caddyfile.vps`). Grey cloud also works — TLS is Let's-Encrypt regardless.

Wait for DNS propagation (1–2 min on Cloudflare).

```bash
dig +short <tenant>.ubntag.com
```

### Step 3.2 — Per-tenant directory + config

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242

TENANT=<tenant-slug>
mkdir -p /home/tagai/tenants/$TENANT/.openclaw
chown -R tagai:tagai /home/tagai/tenants/$TENANT

# Seed the openclaw.json from the master template, with this tenant's identity
cp /home/tagai/.openclaw/openclaw.json /home/tagai/tenants/$TENANT/.openclaw/openclaw.json
# Edit meta.tenantId, agents[*].name, channels.telegram.botToken to be tenant-specific
```

### Step 3.3 — Per-tenant secrets (which are shared vs scoped)

Per `services/SECRETS.json`:

| Variable | Shared or scoped? |
| --- | --- |
| `ANTHROPIC_API_KEY` | Shared (per-tenant quota tracked via Anthropic dashboard) |
| `OPENAI_API_KEY` | Shared |
| `DEEPSEEK_API_KEY` | Shared |
| `OPENROUTER_API_KEY` | Shared |
| `SUPABASE_*` | **Scoped** — each tenant gets their own Supabase project OR row-level-security tenant_id |
| `TELEGRAM_BOT_TOKEN` | **Scoped** — each tenant gets their own bot via @BotFather |
| `MS_CLIENT_*` | **Scoped** if tenant has their own Microsoft 365; shared if using TAG-managed tenant |
| `TELNYX_*`, `TWILIO_*`, `VAPI_*` | **Scoped** — separate phone numbers, separate billing |
| `LIVEKIT_*` | Shared LiveKit Cloud, scoped via room name prefix |

Write tenant-scoped vars to `/home/tagai/tenants/$TENANT/.openclaw/.env`. Inherit shared vars by `source`ing the master at the top:

```bash
cat > /home/tagai/tenants/$TENANT/.openclaw/.env <<'EOF'
# Inherit shared TAG-level keys
set -a
source /home/tagai/.tagai-env
set +a
# Tenant-scoped overrides below
TELEGRAM_BOT_TOKEN=<this tenant's bot>
SUPABASE_URL=<this tenant's project URL>
SUPABASE_KEY=<this tenant's service-role key>
EOF
chmod 600 /home/tagai/tenants/$TENANT/.openclaw/.env
```

### Step 3.4 — Compose file for the tenant container

Each tenant gets its own gateway container on a distinct port. Reserve ports in 18800-block (next free is 18800).

```yaml
# /home/tagai/tenants/$TENANT/docker-compose.yml
services:
  openclaw-gateway:
    image: openclaw:tagai  # pinned in master .env; same image for all tenants
    container_name: openclaw-${TENANT}
    command: ["node","dist/index.js","gateway","--bind","lan","--port","18800"]
    ports:
      - "127.0.0.1:18800:18800"
    env_file:
      - /home/tagai/tenants/${TENANT}/.openclaw/.env
    volumes:
      - /home/tagai/tenants/${TENANT}/.openclaw:/home/node/.openclaw
    restart: unless-stopped
    healthcheck:
      test: ["CMD","node","-e","require('http').get('http://127.0.0.1:18800/healthz',r=>process.exit(r.statusCode===200?0:1))"]
      interval: 30s
      timeout: 5s
      retries: 5
```

```bash
cd /home/tagai/tenants/$TENANT && TENANT=$TENANT docker compose up -d
```

### Step 3.5 — Caddy block for the tenant

```bash
sudo tee /etc/caddy/Caddyfile.d/$TENANT.conf <<EOF
$TENANT.ubntag.com {
  encode gzip
  reverse_proxy 127.0.0.1:18800
  header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  header X-Content-Type-Options "nosniff"
  header X-Frame-Options "DENY"
}
EOF

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The main Caddyfile already does `import Caddyfile.d/*.conf`, so the new tenant goes live on reload.

### Step 3.6 — First-boot verification checklist

```bash
# Container is up
docker ps | grep openclaw-$TENANT

# Gateway healthcheck inside the container
curl -fsS http://127.0.0.1:18800/healthz

# Caddy route end-to-end
curl -fsS https://$TENANT.ubntag.com/healthz

# Hermes runtime came up inside the container
docker exec openclaw-$TENANT ls /home/node/.hermes/gateway.pid

# Telegram bot answers /ping (if tenant has Telegram)
# Send /ping to the bot from the allowed user; expect a reply within 3s.
```

All green = tenant onboarded. Add the tenant to `corp/tenants.json` and announce.

---

## Section 4 — Rotate a leaked credential

> Source: `services/SECRETS.json#duplicate_secrets`. The top three leak-radius keys are `ANTHROPIC_API_KEY` (4 files), `MS_CLIENT_SECRET` (4 files), `RESEND_API_KEY` (5 files).

### Canonical rotation sequence

For ANY key. Adjust file list from `services/SECRETS.json#duplicate_secrets` for the specific var.

#### Step 4.1 — Generate the new key (provider side)

| Provider | Where |
| --- | --- |
| Anthropic | https://console.anthropic.com/settings/keys -> Create Key |
| Microsoft Azure | Azure Portal -> App registrations -> TAG-AI app -> Certificates & secrets -> New client secret |
| Resend | https://resend.com/api-keys -> Create API Key (scope: sending domain only) |
| Supabase | Dashboard -> Project Settings -> API -> service_role rotate |
| Telnyx | Portal -> API Keys -> Create |
| OpenAI | https://platform.openai.com/api-keys -> Create |

**Do not invalidate the old key yet** — you want both live during the rollout window.

#### Step 4.2 — Update the master env file(s)

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242

# Always update both masters. The shell-level master:
nano /home/tagai/.tagai-env
# ...replace ANTHROPIC_API_KEY=...

# The container-level master:
nano /home/tagai/.openclaw/.env
# ...replace ANTHROPIC_API_KEY=...
```

Each master has `chmod 600` and `chown tagai:tagai`. Preserve those.

#### Step 4.3 — Update every duplicate (until consolidation is done)

For `ANTHROPIC_API_KEY`, the audit found 4 copies (per `services/SECRETS.json#duplicate_secrets[0]`):

```bash
for f in \
  /home/tagai/openclaw/.env \
  /home/tagai/.tagai-env \
  /home/tagai/clients/michelle-fb/hetzner/.env \
  /opt/tour-book/.env; do
  echo "Editing $f"
  sudo -u $(stat -c '%U' $f) nano "$f"
done
```

(Replace the file list with whichever variable's `appears_in` list from SECRETS.json applies.)

#### Step 4.4 — Restart consuming services

```bash
# Container-based services pick up the new env on restart
cd /home/tagai/openclaw && docker compose restart openclaw-gateway

# If the var is in /opt/tour-book/.env or /opt/michelle-cma/.env
cd /opt/tour-book && docker compose restart
cd /opt/michelle-cma && docker compose restart

# Systemd service
sudo systemctl restart jarvis-vapi-webhook.service

# PM2 service (root-owned)
sudo pm2 restart voiceai-server --update-env
```

#### Step 4.5 — Verify the new key works

```bash
# Wait for healthcheck
sleep 10
curl -fsS http://127.0.0.1:18789/healthz

# Tail logs for auth errors (401/403 against the provider)
docker logs --tail 50 openclaw-openclaw-gateway-1 | grep -iE '401|403|unauthorized|invalid api key'
```

If clean, the new key is in service.

#### Step 4.6 — Revoke the OLD key

Go back to the provider dashboard and delete the old key. Now you're done.

### Special case: the `secrets/` directory

Per `services/SECRETS.json#credential_stores`, there's a parallel store at `/home/tagai/.openclaw/secrets/` containing `github.token`, `resend.token`, `vercel.token`. These are **plaintext files**, one secret per file. For these:

```bash
echo -n "new-token-here" > /home/tagai/.openclaw/secrets/resend.token
chmod 600 /home/tagai/.openclaw/secrets/resend.token
docker compose restart openclaw-gateway  # if container reads from this path
```

**Consolidation target** (per `services/SECRETS.json#consolidation_recommendation`): merge `secrets/*.token` contents INTO the master env files. Maintaining two parallel secret stores doubles the rotation work.

### Rotation cadence

Quarterly for the top-3 duplicates: `ANTHROPIC_API_KEY`, `MS_CLIENT_SECRET`, `RESEND_API_KEY`. Annual for everything else unless a leak is suspected.

---

## Section 5 — Handle gateway crash-loop

Symptoms (any of these):

- `502 Bad Gateway` from `openclaw.ubntag.com`
- WebSocket close `1006`
- `ERR_INVALID_RESPONSE` in browser console
- `docker ps` shows `openclaw-openclaw-gateway-1` is `Restarting (1)` repeatedly
- Telegram bot stops replying

Source: `MEMORY.md` session-log 2026-05-07 + `drift/SCHEMA-RISK.json#incident_log`.

### 5.1 First check — has openclaw.json been clobbered?

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242

ls -la /home/tagai/.openclaw/openclaw.json*
```

Look for an `openclaw.json.clobbered.*` file with a timestamp from the **last few minutes**. If you see one:

```bash
# Stop the container immediately so it doesn't keep clobbering
cd /home/tagai/openclaw && docker compose stop openclaw-gateway

# Restore from last-good
cp /home/tagai/.openclaw/openclaw.json.last-good \
   /home/tagai/.openclaw/openclaw.json

# Now you MUST fix the version mismatch — see Section 2.
# Discover the runtime version and patch meta.lastTouchedVersion BEFORE restart:
NEW_VERSION=$(docker run --rm --entrypoint=node openclaw:tagai \
  -e 'console.log(require("/home/node/package.json").version)')
echo "Runtime expects version: $NEW_VERSION"
python3 -c "
import json
p='/home/tagai/.openclaw/openclaw.json'
d=json.load(open(p))
d['meta']['lastTouchedVersion']='$NEW_VERSION'
json.dump(d, open(p,'w'), indent=2)
"

# Now restart
docker compose up -d openclaw-gateway
sleep 8 && curl -fsS http://127.0.0.1:18789/healthz
```

### 5.2 If container won't start at all

```bash
docker compose logs --tail 200 openclaw-gateway
```

Common causes:

| Symptom in log | Cause | Fix |
| --- | --- | --- |
| `Cannot find module 'grammy'` | grammy patch lost (see [Section 6.2](#62-grammy-patch-out-of-band)) | Rebuild image WITH grammy in package.json, or reapply patch |
| `EADDRINUSE :::18789` | Old container didn't release port | `docker compose down && docker compose up -d` |
| `error reading openclaw.json: SyntaxError` | Config file got corrupted | Restore from `openclaw.json.last-good` |
| `ENOENT: no such file or directory '/home/node/.openclaw/...'` | Bind mount path missing on host | `ls -la /home/tagai/.openclaw/` and recreate missing dir |

### 5.3 If healthcheck fails but container is "Up"

The container is up but the gateway process inside is not serving:

```bash
docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.hermes/gateway.pid
docker exec openclaw-openclaw-gateway-1 ps -ef
docker exec openclaw-openclaw-gateway-1 cat /tmp/hermes-gateway.log | tail -50
```

Per `hermes-swarm/HERMES.json#layer_1_container_runtime#lifecycle`, the Hermes gateway inside the container starts via:

```bash
docker exec openclaw-openclaw-gateway-1 bash -c \
  "cd ~/.hermes && nohup ~/.local/bin/hermes gateway --accept-hooks > /tmp/hermes-gateway.log 2>&1 &"
```

If that's missing, the in-container Jarvis brain isn't running. Restart the container — its entrypoint should bring Hermes back up.

### 5.4 If Caddy returns 502 but the upstream is fine

```bash
# Confirm the port is bound on the host
sudo ss -tlnp | grep -E ':18789|:8080|:3000|:18792'

# Check Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl status caddy
sudo journalctl -u caddy -n 50 --no-pager
```

If port 18789 is NOT in the `ss` output, Docker isn't binding it. Check `docker compose ps` and the compose file's `ports:` section.

### 5.5 Rollback to previous image

```bash
# What images do we have?
docker images openclaw

# Stop current
cd /home/tagai/openclaw && docker compose down

# Pin to known-good in .env
sed -i 's|^OPENCLAW_IMAGE=.*|OPENCLAW_IMAGE=openclaw:tagai-pre-grammy|' /home/tagai/openclaw/.env

# Bring it back
docker compose up -d

# Verify
sleep 8 && curl -fsS http://127.0.0.1:18789/healthz
```

> Caveat: rolling back to `openclaw:tagai-pre-grammy` will re-introduce the Telegram crash bug (per `drift/DRIFT.json#openclaw_image_drift`). Only do this if Telegram is acceptable collateral.

---

## Section 6 — Fix the 4 critical hygiene issues we found

The audit surfaced four P0/P1 issues that must be remediated before scaling. All four have exact source citations.

### 6.1 Two orphan Caddy routes

Source: `services/ROUTES.json#anomalies` + `services/SERVICES.json#anomalies`.

**Issue A — `michelle-fb.ubntag.com`**: Caddy proxies to `localhost:8000`. **Nothing is listening on 8000.** Returns 502 to every caller.

**Issue B — `michelle-fb-status.ubntag.com`**: Caddy proxies to `localhost:8001`. The `tour-book` container DOES listen on 8001 but **only on its Docker network IP `172.19.0.2:8001`**, not on the host's localhost.

**Fix A — decide: start the service or remove the route.** If `michelle-fb` is dead, delete the route:

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
sudo nano /etc/caddy/Caddyfile  # delete the michelle-fb.ubntag.com block
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Fix B — bind tour-book's port to the host.** Edit `/opt/tour-book/docker-compose.yml`:

```yaml
services:
  tour-book:
    ports:
      - "127.0.0.1:8001:8001"   # add this line
```

```bash
cd /opt/tour-book && docker compose up -d
curl -fsS http://127.0.0.1:8001/health  # should now respond
curl -fsS https://michelle-fb-status.ubntag.com/health  # end-to-end
```

Alternative (zero compose changes): point Caddy at the Docker network IP directly:

```caddy
michelle-fb-status.ubntag.com {
  reverse_proxy 172.19.0.2:8001
}
```

But this only works as long as Docker assigns the same IP — fragile. Prefer the bind-mount approach.

### 6.2 Grammy patch out-of-band

Source: `drift/DRIFT.json#openclaw_image_drift`.

`grammy@^1.42.0` is installed via a hand-written Dockerfile at `/home/tagai/openclaw-grammy-patch/` that layers it on top of `openclaw:tagai-pre-grammy`. The patch is NOT in any committed package.json. If anyone rebuilds the image from `GusAI40/openclaw-1` source tree, **grammy disappears and Telegram crashes again** — exactly the 2026-05-07 incident.

**Fix:**

```bash
# 1) On Windows (local clone), bake grammy into package.json
cd C:/Users/gsanc/TAG-Projects-2026/openclaw-4-25-26
# Edit package.json -> add "grammy": "^1.42.0" to dependencies
git add package.json package-lock.json
git commit -m "phase1(hygiene): bake grammy@^1.42.0 into base image, retire out-of-band patch"
git push origin tagai-main

# 2) On VPS, rebuild
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
cd /home/tagai/openclaw && git pull
docker compose build --no-cache openclaw-gateway
docker compose up -d

# 3) Verify
docker exec openclaw-openclaw-gateway-1 \
  node -e 'console.log("grammy:",require("/app/node_modules/grammy/package.json").version)'
# Expect: grammy: 1.42.x

# 4) Retire the patch + old images
rm -rf /home/tagai/openclaw-grammy-patch
docker rmi openclaw:tagai-pre-grammy openclaw:tagai-grammy
```

This reclaims ~9GB of disk per `drift/DRIFT.json#openclaw_image_drift#recommended_cleanup`.

### 6.3 /opt/ apps owned by Windows UID 197609

Source: `drift/DRIFT.json#services` (michelle-cma, tour-book, voiceai entries).

Three production services live under `/opt/` and are owned by UID 197609 (Gus's Windows account, from rsync/scp). None have a `.git` directory. Any laptop edit silently overwrites prod. Zero rollback capability.

**Pattern (do each of the three):**

```bash
# === LOCAL (Windows): identify the source dir and push to GitHub ===
# For michelle-cma:
cd C:/Users/gsanc/TAG-Projects-2026/Michelle-CBR-Active-CMA
git init
git add -A
git commit -m "initial commit of michelle-cma deployed source"
gh repo create GusAI40/Michelle-CMA-Server --private --source=. --remote=origin --push

# === ON VPS: replace the /opt copy with a git clone ===
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
SERVICE=michelle-cma
REPO=git@github.com:GusAI40/Michelle-CMA-Server.git

# Stop the service
cd /opt/$SERVICE && sudo docker compose down

# Park the UID-197609 copy as a safety backup
sudo mv /opt/$SERVICE /opt/$SERVICE.uid197609.bak.$(date -u +%Y%m%d)

# Re-deploy via git
sudo git clone $REPO /opt/$SERVICE
sudo chown -R tagai:tagai /opt/$SERVICE

# Re-create the .env that didn't go through git
sudo cp /opt/$SERVICE.uid197609.bak.*/.env /opt/$SERVICE/.env
sudo chown tagai:tagai /opt/$SERVICE/.env
sudo chmod 600 /opt/$SERVICE/.env

# Bring it back up
cd /opt/$SERVICE && docker compose up -d --build
sleep 10 && curl -fsS https://cma.ubntag.com/health  # (or appropriate endpoint)

# 30 days later, after confidence:
sudo rm -rf /opt/$SERVICE.uid197609.bak.*
```

Repeat for:

- `tour-book` -> probable source `C:/Users/gsanc/TAG-Projects-2026/Michelle-CBR-Home-TOURS/` -> repo `GusAI40/Michelle-Tour-Book`
- `voiceai` -> probable source `C:/Users/gsanc/TAG-Projects-2026/TAG-Tools-VoiceAI/` -> repo `GusAI40/TAG-VoiceAI` (and confirm the runtime — `systemctl` + `pm2 list` per `drift/DRIFT.json#services[3]#remediation`)

**Sanity check** when done:

```bash
for s in michelle-cma tour-book voiceai; do
  echo "=== /opt/$s ==="
  stat -c "%U:%G %a %n" /opt/$s
  ls -la /opt/$s/.git/HEAD 2>/dev/null && echo "  git-tracked OK" || echo "  STILL NOT GIT-TRACKED"
done
```

Expected: each line shows `tagai:tagai` and `git-tracked OK`.

### 6.4 GitHub PATs in workspace remotes

Source: `drift/DRIFT.json#workspace_repos_on_vps`.

Seven repos under `/home/tagai/.openclaw/workspace/` have GitHub Personal Access Tokens embedded directly in their remote URLs (e.g. `https://ghp_xxx@github.com/...`). Any `git remote -v` leaks the token to logs / screen shares / Claude transcripts (also see global rule `kb_claude_conversation_log_security.md`).

**Fix — rotate the PATs first, then rewrite the remotes:**

```bash
# Step 1 — on GitHub, revoke the existing PAT(s) and create new ones
# https://github.com/settings/tokens — fine-grained, repo-scoped, 90-day expiry

# Step 2 — install the new PAT in git-credential-store ONCE on the VPS
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
git config --global credential.helper store
# Then on first push it prompts; from then on the token is in ~/.git-credentials (chmod 600)
chmod 600 ~/.git-credentials

# Step 3 — rewrite every workspace remote to remove the embedded PAT
cd /home/tagai/.openclaw/workspace
for d in SalesEdge-5-11-26 AI-Hybrid-Telemarketer Michelle-Sanchez-CB-Realty-v3-NextJS \
         tag-ai-website-openclaw-2026-05-01 ubntag web-app; do
  [ -d "$d/.git" ] || continue
  cd /home/tagai/.openclaw/workspace/$d
  CURRENT=$(git remote get-url origin)
  # Strip user:pat@ prefix
  CLEAN=$(echo "$CURRENT" | sed -E 's#https://[^@]+@#https://#')
  echo "$d: $CURRENT  ->  $CLEAN"
  git remote set-url origin "$CLEAN"
done

# Step 4 — fix the two misconfigured remotes (per DRIFT.json)
cd /home/tagai/.openclaw/workspace/ubntag
git remote set-url origin https://github.com/GusAI40/ubntag.git   # confirm correct repo name

cd /home/tagai/.openclaw/workspace/web-app
git remote set-url origin https://github.com/GusAI40/<actual-web-app-repo>.git
```

**Better alternative: switch to SSH keys** (no expiry, no leakage in URLs):

```bash
ssh-keygen -t ed25519 -C "tagai-cloud" -f ~/.ssh/id_github -N ""
cat ~/.ssh/id_github.pub  # add this to https://github.com/settings/keys
# Then per repo:
git remote set-url origin git@github.com:GusAI40/<repo>.git
```

Also: handle the orphan repo `jarvis-infrastructure` (no remote, 1 commit `edc113f`). Per `drift/DRIFT.json#workspace_repos_on_vps`, either push it to a new GitHub repo or document why it's intentionally local.

---

## Section 7 — Backups

Source: `services/DATA.json#backups_directory_audit` + `services/DATA.json#recommended_backup_retention_policy`.

> The current state: `/home/tagai/.openclaw/backups/` exists but is **EMPTY**. Nothing has ever been written to it. We're flying without a parachute.

### 7.1 What MUST be backed up vs what can be regenerated

Per `services/DATA.json#biggest_state_dirs_ranked`, of the 36 persistent dirs:

| Tier | Dirs | Why |
| --- | --- | --- |
| Critical (hourly) | `memory/main.sqlite`, `openclaw.json`, `credentials/`, `identity/`, `secrets/` | Primary DB + bot identity + tokens. Losing any = service down. |
| State (daily) | `hindsight/`, `flows/`, `tasks/`, `wiki/`, `corp/`, `media/`, `projects/` | Agent long-term memory, automation IP, generated artifacts. Cannot be regenerated. |
| Workspace (weekly) | `workspace/` minus `node_modules` | Can be re-cloned from git, but .env files and uncommitted work can't |
| Exclude | `.pnpm-store/`, `plugin-runtime-deps/`, `logs/`, `extensions/`, any `node_modules` | All regeneratable; would bloat backups |

### 7.2 The tiered cron

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
mkdir -p /home/tagai/.openclaw/backups/{hourly,daily,weekly}

# Write the backup script
cat > /home/tagai/bin/openclaw-backup.sh <<'EOF'
#!/bin/bash
set -euo pipefail
ROOT=/home/tagai/.openclaw
DEST=$ROOT/backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

case "${1:-hourly}" in
  hourly)
    OUT=$DEST/hourly/snapshot-$STAMP.tar.gz
    tar czf "$OUT" \
      -C "$ROOT" memory/main.sqlite memory/main.sqlite-shm memory/main.sqlite-wal \
      openclaw.json credentials identity secrets 2>/dev/null || true
    # Keep last 24
    ls -1t $DEST/hourly/snapshot-*.tar.gz | tail -n +25 | xargs -r rm -f
    ;;
  daily)
    OUT=$DEST/daily/snapshot-$STAMP.tar.gz
    tar czf "$OUT" \
      -C "$ROOT" hindsight flows tasks wiki corp media projects \
      --exclude='**/node_modules' 2>/dev/null || true
    ls -1t $DEST/daily/snapshot-*.tar.gz | tail -n +8 | xargs -r rm -f
    ;;
  weekly)
    OUT=$DEST/weekly/snapshot-$STAMP.tar.gz
    tar czf "$OUT" \
      -C "$ROOT" workspace \
      --exclude='**/node_modules' \
      --exclude='**/.next' \
      --exclude='**/dist' \
      --exclude='**/.pnpm-store' 2>/dev/null || true
    ls -1t $DEST/weekly/snapshot-*.tar.gz | tail -n +5 | xargs -r rm -f
    ;;
esac
EOF
chmod +x /home/tagai/bin/openclaw-backup.sh
```

Add to crontab:

```bash
crontab -e
```

Append:

```cron
# OpenClaw tiered backups
0 * * * * /home/tagai/bin/openclaw-backup.sh hourly  >> /home/tagai/.openclaw/logs/backup.log 2>&1
0 3 * * * /home/tagai/bin/openclaw-backup.sh daily   >> /home/tagai/.openclaw/logs/backup.log 2>&1
0 4 * * 0 /home/tagai/bin/openclaw-backup.sh weekly  >> /home/tagai/.openclaw/logs/backup.log 2>&1
```

### 7.3 Off-site replication

The cron above only writes to local disk — useless if the VPS is lost. Add an off-site step:

```bash
# Add to crontab — 15 min after the weekly backup, push everything off-site.
15 4 * * 0 rsync -avz --delete \
  /home/tagai/.openclaw/backups/ \
  u<ID>@<storagebox>.your-storagebox.de:/home/openclaw-backups/ \
  >> /home/tagai/.openclaw/logs/backup.log 2>&1
```

Or, for Backblaze B2 (S3-compatible):

```bash
# Requires `rclone` configured with B2 token under remote name "b2"
30 4 * * 0 rclone sync /home/tagai/.openclaw/backups b2:tagai-backups \
  >> /home/tagai/.openclaw/logs/backup.log 2>&1
```

### 7.4 Test the backups (most-skipped step)

A backup that nobody has restored is not a backup. Quarterly:

```bash
# Pick a recent snapshot, extract to a scratch location, eyeball it
mkdir -p /tmp/restore-test
tar xzf /home/tagai/.openclaw/backups/daily/snapshot-<latest>.tar.gz -C /tmp/restore-test
ls -la /tmp/restore-test/hindsight | head
sqlite3 /tmp/restore-test/memory/main.sqlite '.tables'  # or whichever Hermes DB
rm -rf /tmp/restore-test
```

Good signs: hindsight directory present, sqlite opens, table list looks sane.

---

## Section 8 — Scaling to 100 tenants

> Current state (per `services/SERVICES.json#vps`): single Hetzner CPX21 with 4 vCPU / 8GB / ~29% disk used. Comfortably runs ~5 OpenClaw containers at the current load. Hermes runs **inside** each container (`hermes-swarm/HERMES.json#layer_1_container_runtime`), so per-tenant cost is dominated by RAM.

### Per-tenant resource budget (measured + estimated)

| Component | Idle | Active call/agent |
| --- | --- | --- |
| OpenClaw gateway container | ~250 MB | ~700 MB |
| Hermes runtime inside container | ~200 MB | ~600 MB |
| LiveKit agent (when voice live) | ~150 MB | ~400 MB |
| **Total per tenant** | **~500 MB** | **~1.5 GB** |

CPU: bursts to 50-100% of 1 vCPU during agent reasoning steps. Mostly idle otherwise.

Disk: ~250 MB persistent state per tenant + ~50 MB/day hindsight growth.

### Scaling tiers

| Tenants | Recommended infra | Why |
| --- | --- | --- |
| 1-10 | Current CPX21 | Plenty of headroom |
| 10-25 | Upgrade to CPX31 (8 vCPU, 16 GB) | Single-host still manageable |
| 25-40 | CPX41 (16 vCPU, 32 GB) | RAM-bound — 40 tenants × 700MB active avg = 28GB |
| 40-100 | Shard across N CPX-class machines, **OR** move OpenClaw to k8s with autoscaling | Bin-pack tenants by activity profile (10-20 per host) |
| 100+ | Kubernetes is the right answer | Per-tenant pod, HPA on CPU, PVC for state, Cilium for tenant network isolation |

### Already-built scale primitives

Per `hermes-swarm/HERMES.json#replication_implications` and the audit's Caddy template:

1. **Caddyfile.d pattern** — the master Caddyfile does `import Caddyfile.d/*.conf`. Each tenant gets one file. Already designed for fan-out. See `vps-snapshot/Caddyfile.vps`.
2. **Per-tenant openclaw.json** — config is per-mount, so each tenant gets their own `/home/tagai/tenants/<id>/.openclaw/openclaw.json`. No shared mutable state.
3. **Shared LLM keys with quota tracking** — Anthropic/OpenAI/DeepSeek keys are tenant-agnostic; tracking happens at the provider dashboard or via a usage column in Supabase.
4. **Tenant-scoped Telegram bots** — each tenant gets their own bot via `@BotFather` (~30s to provision). Token goes in tenant-scoped `.env`.
5. **`tenant_id` propagation** — kanban tasks, sessions, memories must include `tenant_id` for isolation. This is the **one thing that needs code work** before scaling — see `hermes-swarm/HERMES.json#gaps_blocking_swarm_activation`.

### What blocks scale today (must fix before tenant #2)

Per `hermes-swarm/HERMES.json#gaps_blocking_swarm_activation`:

- `kanban.db` is per-container — no multi-tenant scoping inside it. Either give each tenant their own DB file (current design) or refactor to add `tenant_id` columns.
- 97 of 100 designed worker skills don't exist yet — affects feature parity, not scale.
- LiveKit voice channel pending credentials — affects feature, not scale.

### Cost ladder

| Tier | Monthly infra | Per-tenant amortized |
| --- | --- | --- |
| CPX21 / 10 tenants | ~$10 | $1.00 |
| CPX41 / 30 tenants | ~$60 | $2.00 |
| 4 × CPX41 / 100 tenants | ~$240 | $2.40 |
| k8s / 100+ tenants | ~$500-1000 | $5-10 |

The k8s tax is real — only justify it past ~150 tenants or when SLA requires multi-region failover.

---

## Section 9 — The escalation ladder

When something is broken, investigate in this order. Each rung resolves ~80% of cases at that level.

### Rung 1 — Is Caddy up?

```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242 \
  "systemctl is-active caddy && curl -fsSI https://openclaw.ubntag.com/ | head -3"
```

If Caddy is dead: `sudo systemctl restart caddy`. If the restart fails: `sudo caddy validate --config /etc/caddy/Caddyfile` and read the error.

### Rung 2 — Is the upstream service alive?

```bash
docker ps
sudo ss -tlnp | grep -E ':18789|:8080|:3000|:18792'
```

If the container is dead: `docker compose up -d` (in its directory). If still failing: `docker compose logs --tail 100`.

### Rung 3 — Is openclaw.json fresh, or freshly clobbered?

```bash
ls -la /home/tagai/.openclaw/openclaw.json* | tail -10
```

If a new `.clobbered.*` file exists with today's date -> go to [Section 5.1](#51-first-check--has-openclawjson-been-clobbered).

### Rung 4 — Is Hermes alive inside the container?

```bash
docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.hermes/gateway.pid
docker exec openclaw-openclaw-gateway-1 tail -50 /tmp/hermes-gateway.log
```

If `gateway.pid` is missing, Hermes never started. Restart the container.

### Rung 5 — Is an external API provider down?

The OpenClaw runtime calls many external APIs. Check their status pages:

- DeepSeek: https://status.deepseek.com
- Anthropic: https://status.anthropic.com
- OpenAI: https://status.openai.com
- OpenRouter: https://status.openrouter.ai
- Telnyx: https://status.telnyx.com
- LiveKit: https://status.livekit.io
- Supabase: https://status.supabase.com
- Microsoft Graph: https://status.office365.com
- Cloudflare: https://www.cloudflarestatus.com
- Hetzner: https://status.hetzner.com

A provider 5xx will surface as gateway errors in our logs — don't chase it locally.

### Rung 6 — Disk full?

```bash
df -h /
du -sh /home/tagai/.openclaw/* | sort -h | tail -10
```

Common offenders: `workspace/` (6.7G — mostly node_modules), `plugin-runtime-deps/` (593M — safe to wipe), `logs/`. Per `services/DATA.json#exclude_from_all_backups`, those are regeneratable.

### Rung 7 — Memory pressure?

```bash
free -h
docker stats --no-stream
dmesg | grep -i 'killed process' | tail -5
```

OOM-killer activity in dmesg = a container got murdered. Bump container memory limits or move to CPX31.

### Rung 8 — Did a recent commit break something?

```bash
cd /home/tagai/openclaw && git log --oneline -20
```

Look for commits within an hour of the breakage. If suspect, `git checkout <previous-sha>` and rebuild.

### When to page Gus

- Rung 5+ exhausted without resolution
- Production data loss (`hindsight/`, `memory/`, `credentials/` corrupted or missing)
- Security incident (unexpected `.clobbered.*`, unauthorized SSH, leaked PAT in git history)
- Customer-impacting outage > 15 min

---

## Section 10 — Glossary

> One sentence each. For deeper context, follow the link.

- **Hermes** — The AI brain that runs inside each OpenClaw container; the "CTO of TAG AI Corp." Lives at `/home/node/.hermes/` (`hermes-swarm/HERMES.json#layer_1_container_runtime`).
- **Jarvis** — Marketing name for the user-facing Hermes; also the project umbrella for the OpenClaw VPS. (See `CLAUDE.md`.)
- **OpenClaw** — The gateway runtime — multi-MCP orchestrator, plugin host, channel router. Container image `openclaw:tagai`. (`services/SERVICES.json#services[0]`.)
- **Hindsight** — Long-term agent memory store (~233 MB). If lost, agents forget everything. (`services/DATA.json` row `hindsight`.)
- **MCP** — Model Context Protocol; each MCP server (Supabase, Microsoft Graph, etc.) gives Hermes access to a specific external system. Installed at `/home/tagai/.openclaw/mcp-servers/`.
- **Vapi** — Cloud voice-agent platform; bridges PSTN calls to LLMs. Webhook handler runs on systemd port `18792` (`services/SERVICES.json#services[4]`).
- **LiveKit** — Real-time WebRTC infrastructure for voice/video; TAG's planned voice transport. (See global rule `livekit-cli`.)
- **Telnyx** — Primary PSTN provider — phone numbers, SIP trunks. (`services/SECRETS.json` `TELNYX_*` vars.)
- **Cartesia** — Text-to-speech provider used by the voice stack. (`services/SECRETS.json` `CARTESIA_API_KEY`.)
- **Deepgram** — Speech-to-text provider used by the voice stack. (`services/SECRETS.json` `DEEPGRAM_API_KEY`.)
- **Caddy** — TLS-terminating reverse proxy on `:80`/`:443`. Config at `/etc/caddy/Caddyfile` (`vps-snapshot/Caddyfile.vps`).
- **PM2** — Node.js process manager — currently runs `voiceai-server`. Auto-restarts via `pm2-root.service`.
- **Grammy** — Telegram bot framework; `^1.42.0` required for in-container Telegram bots. (`drift/DRIFT.json#openclaw_image_drift`.)
- **`.clobbered.*` files** — Forensic snapshots created when the runtime version doesn't match `meta.lastTouchedVersion`. The kill-switch field. (`drift/SCHEMA-RISK.json#the_kill_switch_field`.)
- **`openclaw.json.last-good`** — Manually-maintained byte-identical copy of the current production config; recovery source after a clobber.
- **Hermes Army** — The 100-agent corporation roster (3 of 100 worker skills implemented today). (`hermes-swarm/HERMES.json#layer_3_skill_bundle_hermes_army`.)

---

## Appendix A — Where each procedure was derived from

| Section | Primary audit source |
| --- | --- |
| 0 — Cold-start | `services/SERVICES.json#vps` + `services/ROUTES.json` |
| 1 — Daily health | `services/SERVICES.json` + `drift/SCHEMA-RISK.json#incident_log` |
| 2 — Safe image upgrade | `drift/SCHEMA-RISK.json` (entire file) |
| 3 — Add a tenant | `services/ROUTES.json` + `hermes-swarm/HERMES.json#replication_implications` |
| 4 — Rotate credential | `services/SECRETS.json#duplicate_secrets` |
| 5 — Crash-loop | `drift/SCHEMA-RISK.json#incident_log` + memory `2026-05-07` session log |
| 6.1 — Orphan routes | `services/ROUTES.json#anomalies` |
| 6.2 — Grammy patch | `drift/DRIFT.json#openclaw_image_drift` |
| 6.3 — /opt UID drift | `drift/DRIFT.json#services` |
| 6.4 — PATs in remotes | `drift/DRIFT.json#workspace_repos_on_vps` |
| 7 — Backups | `services/DATA.json#recommended_backup_retention_policy` |
| 8 — Scaling | `services/SERVICES.json#vps` + `hermes-swarm/HERMES.json#replication_implications` |
| 9 — Escalation | Aggregated from all four audit dirs |
| 10 — Glossary | Project memory + all audit sources |

---

*Generated 2026-05-11 from audit set `.audit-2026-05-11/`. When the audit re-runs, regenerate this file.*
