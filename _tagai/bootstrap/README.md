# bootstrap-tenant

Operator scaffold that replicates the entire **OpenClaw + Hermes + 100-agent corp** stack for a new tenant on the existing Hetzner CPX21 host, in under 5 minutes, without manual config editing.

## What this is

A parameterized "tenant pack" that materializes one OpenClaw container + one Hermes runtime (inside the container) + one fresh kanban + one cloned 100-agent roster, all isolated from other tenants by:

- **Volume isolation**: `/home/tagai/tenants/<TENANT_ID>/{openclaw,workspace}` — no shared state on disk
- **Port isolation**: deterministic port allocation from a hash of `TENANT_ID` (gateway 18800–18899, bridge 19000–19099)
- **Hostname isolation**: dedicated Caddy site block at `<DOMAIN>` reverse-proxying ONLY this tenant's gateway port
- **Token isolation**: per-tenant `OPENCLAW_GATEWAY_TOKEN` generated at bootstrap
- **Identity isolation**: per-tenant system prompt, per-tenant Hermes Telegram bot allowlist, per-tenant CORP-IDs prefixed with `<TENANT_ID>-`

## What this is NOT (shared infrastructure assumption)

The following are **shared across all tenants** and consume the host's existing accounts/keys — they are intentionally NOT replicated per-tenant:

| Resource | Why shared | Per-tenant scoping mechanism |
|---|---|---|
| Telnyx SIP trunk | Single carrier account, billing aggregated | Per-tenant prospect lists; caller-ID is shared until each tenant brings their own DID |
| LiveKit Cloud | Single project, billing aggregated | Per-tenant room naming (`room-<TENANT_ID>`) |
| Supabase (data + functions) | Single project, RLS on `tenant_id` column | All tenant rows tagged with `tenant_id` |
| Caddy + Docker daemon | Single host process | Per-tenant site block + container |
| Hetzner CPX21 box | Single VPS | All tenants colocate; vertical scale until ~5–10 tenants forces split |
| DeepSeek / Anthropic / OpenAI API keys | Single account | Quota tracked per-tenant via Hermes spawn logs |

## Requirements

- Hetzner CPX21 (or equivalent) running as `tagai@<host>` with sudo
- Docker + Docker Compose v2 installed
- Caddy running with `/etc/caddy/Caddyfile.d/*.conf` import block in the main Caddyfile (see step 2 below)
- DNS for `<DOMAIN>` pointing at the host's public IP (Cloudflare proxy on/off both work)
- `openclaw:tagai` image already pulled OR a pinned version tag available (see `SCHEMA-RISK.json` for why you should pin)
- Shared secrets present at `/home/tagai/.tagai-env` and `/home/tagai/.openclaw-shared.env` (Telnyx, LiveKit, Supabase, etc.)

## One-time host prep

```bash
# 1. Tenant root dir
sudo mkdir -p /home/tagai/tenants /home/tagai/tenants-archived
sudo chown tagai:tagai /home/tagai/tenants /home/tagai/tenants-archived

# 2. Caddy include dir (so per-tenant blocks drop in cleanly)
sudo mkdir -p /etc/caddy/Caddyfile.d
sudo chown tagai:caddy /etc/caddy/Caddyfile.d
# Then add this single line to /etc/caddy/Caddyfile (once, ever):
#   import /etc/caddy/Caddyfile.d/*.conf
sudo systemctl reload caddy
```

## Usage

```bash
cd ~/openclaw-bootstrap   # wherever you cloned this folder

# Provision a new tenant
./bootstrap-tenant.sh julian julian.ubntag.com julian@example.com

# Output:
#   Tenant ID:        julian
#   Domain:           https://julian.ubntag.com
#   Gateway port:     18837 (deterministic from hash(TENANT_ID))
#   Bridge port:      19037
#   Gateway token:    <printed once — save it>
#   Config dir:       /home/tagai/tenants/julian/.openclaw
#   Workspace dir:    /home/tagai/tenants/julian/workspace
#   Container:        openclaw-julian-gateway
#   Caddy block:      /etc/caddy/Caddyfile.d/julian.conf
#   Health check:     200 OK
#
# Total time: ~60-90s (mostly waiting for healthcheck)
```

## Files in this directory

| File | Purpose |
|---|---|
| `bootstrap-tenant.sh` | Main provisioning script |
| `teardown-tenant.sh` | Reverse of bootstrap (archives, never deletes) |
| `list-tenants.sh` | Show all active tenants + status |
| `_template/docker-compose.tenant.yml.tpl` | Parameterized compose file |
| `_template/.env.tpl` | Parameterized env file |
| `_template/openclaw.json.tpl` | Parameterized OpenClaw config |
| `_template/Caddyfile.tenant.conf.tpl` | Parameterized Caddy site block |
| `_template/corp/*.csv` | 100-agent roster templates |
| `_template/hermes-army/*.md` | Hermes skill bundle templates |
| `HERMES-SWARM-EXTRACTION.md` | Architecture notes for the swarm primitive |

## Schema-clobber prevention (read this once)

OpenClaw's runtime compares `meta.lastTouchedVersion` in `openclaw.json` against the image's `package.json` version on every boot. If they don't match, the runtime **snapshots the existing config to `openclaw.json.clobbered.<ISO8601>` and writes fresh defaults**, destroying all per-tenant customization.

Bootstrap reads the running image's version FIRST (via `docker run --rm --entrypoint=node ${OPENCLAW_IMAGE} -e 'console.log(require("/home/node/package.json").version)'`) and bakes that exact version string into the rendered `openclaw.json` at provision time. See `_template/openclaw.json.tpl` and step 6 of `bootstrap-tenant.sh`.

## Recovery

Every step in `bootstrap-tenant.sh` is idempotent: re-running with the same `TENANT_ID` is safe and re-renders templates without losing volume data.

If something fails mid-bootstrap, the `cleanup_on_error` trap tears down created dirs and Caddy entries automatically. To manually tear down: `./teardown-tenant.sh <TENANT_ID>` (archives to `/home/tagai/tenants-archived/`, never deletes).
