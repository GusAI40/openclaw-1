# Jarvis AI — Blueprint

The complete operating manual + replication guide for the TAG fork of OpenClaw.

This is the umbrella document. If you're new here, read this first, then dive into the topic-specific docs in `_tagai/`.

---

## 1. What this is, in one paragraph

OpenClaw is an open-source agent runtime — a single program that gives a large language model a body: a Telegram inbox, a phone line, a web UI, a workspace folder, a memory database, and a tool belt of MCP servers. We forked it (`GusAI40/openclaw-1`, branch `tagai-main`) and added the missing piece for a small business: **the ability to run one box that hosts many independent Jarvis-style assistants**, one per client or team member, each isolated from the others, all sharing the same expensive infrastructure (Telnyx phone, LiveKit voice, Supabase database, LLM accounts).

You spin up a new tenant in 60 seconds by running one shell script. The new tenant gets its own subdomain, its own Telegram bot, its own gateway token, its own workspace volume, its own system prompt, its own auto-approval rules — but it shares the API keys, the carrier accounts, and the database with everyone else. That's the whole point: one $15/month VPS hosts an unlimited number of personalized AI assistants, with strict per-tenant isolation on the things that need to be isolated (memory, identity, billing-attribution) and ruthless sharing on the things that benefit from scale (carrier minutes, LLM volume discounts).

## 2. Why this exists (the mission)

There are three paths to give someone "their own AI assistant":

1. **Build a custom one from scratch.** Six months of engineering, $50K minimum, lock-in to your stack.
2. **Buy a SaaS Jarvis.** $20–$200/month per seat, your data lives on their servers, the assistant works only in their walled garden (their chat, their app — not your Telegram, your phone, your tools).
3. **Run your own.** Use an open-source runtime, self-host on a small VPS, pay carrier and LLM fees at wholesale, own your data.

This fork is option 3 with the rough edges sanded off. The vanilla OpenClaw project is a brilliant single-tenant runtime — it assumes one user, one config dir, one container. That's perfect for a solo developer running their own assistant. It is not enough for a small agency that wants to give each client a Jarvis. Our additions turn it into a small "fleet" platform: a tenant-creation script (`bootstrap-tenant.sh`), a Caddy include directory for per-tenant TLS, a shared-services env file, deterministic port allocation, an off-site backup pipeline, and a system-prompt + skill-stack template you can adapt per client.

The business reason this exists today: TAG sells communication services (E-Rate, carrier resale, copper-sunset migrations, real estate marketing). Each client benefits from a 24/7 assistant that knows their account, watches their inbox, drafts replies, runs their pipelines. We could not build a separate stack per client. We built one stack that scales horizontally per tenant.

## 3. The big picture

```
                        ┌──────────────────────────────────────┐
                        │       Public DNS (Vercel)            │
                        │   *.ubntag.com → 87.99.148.242       │
                        └──────────────────────────────────────┘
                                          │
                                          ▼ HTTPS (Let's Encrypt via Caddy)
                        ┌──────────────────────────────────────┐
                        │ Hetzner CPX21 (4 vCPU, 8GB RAM, $15/mo) │
                        │ host: tagai-cloud / 87.99.148.242    │
                        │                                      │
                        │  ┌───────────────────────────────┐   │
                        │  │ Caddy v2 (on host, not Docker)│   │
                        │  │ /etc/caddy/Caddyfile.d/*.conf │   │
                        │  └─────────┬─────────────────────┘   │
                        │            │ reverse proxy           │
                        │            ▼                         │
                        │  ┌──────────────────────────────────┐│
                        │  │ Docker daemon                    ││
                        │  │                                  ││
                        │  │  ┌──────────────────────────┐    ││
                        │  │  │ openclaw-gateway (GUS)   │    ││  → openclaw.ubntag.com
                        │  │  │ port 18789               │    ││
                        │  │  │ vol /home/tagai/.openclaw│    ││
                        │  │  └──────────────────────────┘    ││
                        │  │                                  ││
                        │  │  ┌──────────────────────────┐    ││
                        │  │  │ openclaw-julian-gateway  │    ││  → julian.ubntag.com
                        │  │  │ port 18884 (loopback)    │    ││
                        │  │  │ vol /home/tagai/tenants/ │    ││
                        │  │  │     julian/.openclaw     │    ││
                        │  │  └──────────────────────────┘    ││
                        │  │                                  ││
                        │  │  ┌──────────────────────────┐    ││
                        │  │  │ ... future tenants ...   │    ││  → <tenant>.ubntag.com
                        │  │  │ ports 18800–18899        │    ││
                        │  │  └──────────────────────────┘    ││
                        │  │                                  ││
                        │  │  Also on this box (separate):    ││
                        │  │  - jarvis-for-gus (LiveKit agent)││
                        │  │  - brightsmile-agent (demo)      ││
                        │  │  - voice-agent-demo              ││
                        │  │  - tour-book, michelle-cma       ││
                        │  └──────────────────────────────────┘│
                        │                                      │
                        │  Shared files all tenants mount:     │
                        │  - ~/.openclaw-shared.env (all API keys) │
                        │  - /home/tagai/shared-projects/      │
                        │      rescue-websites, awesome-design-md │
                        └──────────────────────────────────────┘
                                          │
                                          ▼ outbound APIs
        ┌─────────────────────┬──────────────────┬──────────────────┐
        ▼                     ▼                  ▼                  ▼
   Anthropic +           Telnyx (SIP)         LiveKit Cloud      Supabase
   DeepSeek +            voice                voice/video        (per-tenant
   OpenAI +              (shared trunk)       (shared project)    RLS by tenant_id)
   Google +
   Groq
   (per-tenant
    auth-profiles.json,
    keys shared via
    auth-profiles)

        ┌──────────────────────────────────────────────────────────┐
        ▼                                                          │
   Backup pipeline (nightly 3:00 + 3:30 AM UTC cron):              │
   1. backup.sh tars hindsight, shared-projects, memory.sqlite    │
   2. sync-to-github.sh age-encrypts + pushes as orphan branches  │
      to GusAI40/tagai-cloud-backups (private GitHub repo) ───────┘
```

## 4. The pieces, explained

### 4a. OpenClaw core (upstream, untouched)

`src/`, `extensions/`, `packages/`, `apps/`, `Swabble/` — all upstream code from `openclaw/openclaw`. We do not modify these. The runtime is a Node TypeScript app that:

- Boots a gateway HTTP server (`src/gateway/`)
- Loads channels (`src/channels/` — Telegram, WhatsApp, Slack, Discord, voice via LiveKit)
- Loads plugins (`src/plugins/` — `acpx`, `browser`, `device-pair`, `memory-core`, `phone-control`, `talk-voice`, `telegram`)
- Loads agents (`src/agents/` — the embedded LLM runtime with tool-use, session management, model fallback)
- Loads ~120 extensions from `extensions/` (per-channel and per-provider integrations)

When a message arrives on any channel, the runtime routes it to an agent session, runs an LLM call with tool use, and replies on the same channel. The whole thing is configured by one JSON file at `~/.openclaw/openclaw.json` plus environment variables.

### 4b. `_tagai/` overlay (our additions)

Everything TAG-specific lives in `_tagai/`. It's our scratch space that survives upstream rebases cleanly because we never modify upstream files. Key items:

| File | What it does |
|---|---|
| `_tagai/CLAUDE.md` | Claude Code instructions for this repo (the "reality" doc that overrides stale assumptions) |
| `_tagai/README.md` | Index of overlay files |
| `_tagai/BLUEPRINT.md` | **This file.** Umbrella manual + replication guide |
| `_tagai/DEPLOY_HETZNER.md` | Step-by-step deploy/redeploy procedure |
| `_tagai/HETZNER_PREFLIGHT.md` | What's installed on the box; current server state |
| `_tagai/CADDY_AUDIT.md` | The actual Caddy reverse-proxy config (Caddy on host, not in Docker) |
| `_tagai/ONBOARD_PLAYBOOK.md` / `ONBOARD_RUNBOOK.md` | New-tenant onboarding step-by-step |
| `_tagai/CHANNEL_STRATEGY.md` | Which channels are tier 1 / 2 / 3 and why |
| `_tagai/CAPABILITIES.md` | Inventory of skills the runtime can invoke |
| `_tagai/HEALTH.md` | Where to check status, what "healthy" looks like |
| `_tagai/SERVER_REPO_STATE.md` | Current branch/SHA on Hetzner |
| `_tagai/monitoring/HEALTH_YYYY-MM-DD.md` | Weekly health snapshots |
| `_tagai/monitoring/UPSTREAM_YYYY-MM-DD.md` | Weekly upstream-drift checks |
| `_tagai/docker-compose.tagai.yml` | Optional compose overlay (only relevant for Gus's primary tenant; per-tenant tenants use their own compose) |
| `_tagai/diag-telegram*.sh` | Telegram troubleshooting scripts |

### 4c. The Hetzner box

One $15/month CPX21 server: 4 vCPU, 8 GB RAM, ~80 GB SSD, public IPv4 + IPv6. Hosted in Germany. No Coolify, no Kubernetes, no Traefik, no managed reverse proxy. Just:

- Ubuntu 22.04
- Docker Engine + Docker Compose v2
- Caddy v2 running as a systemd service on the host (handles TLS via Let's Encrypt)
- Cron for backups
- SSH access as `tagai` user (key-only auth)

Per-tenant containers each consume ~150–300 MB RAM. A CPX21 can comfortably host 8–10 tenants before vertical-scaling pressure forces a CX31 upgrade (~$35/month).

### 4d. Per-tenant isolation (what tenants do NOT share)

| Resource | Lives at | Why isolated |
|---|---|---|
| OpenClaw container | `openclaw-<tenant>-gateway` | One process per tenant; restart blast radius = one tenant |
| Workspace volume | `/home/tagai/tenants/<tenant>/workspace/` | Tenant files, downloaded artifacts, code |
| Config + memory volume | `/home/tagai/tenants/<tenant>/.openclaw/` | Per-tenant `openclaw.json`, session history, agent memory, auth-state |
| Gateway port | `18800–18899` (deterministic hash of tenant-id) | One port per tenant on loopback; Caddy proxies the subdomain to the right port |
| Gateway auth token | `/home/tagai/tenants/<tenant>/.gateway-token` | One token per tenant; never shared |
| Caddy site block | `/etc/caddy/Caddyfile.d/<tenant>.conf` | One subdomain per tenant |
| Telegram bot token | per-tenant `.env` | Each tenant has its own bot (`@JujuJarvis_bot`, etc.) |
| System prompt | per-tenant `openclaw.json` → `agents.defaults.systemPromptOverride` | Each tenant has a distinct persona |
| Telegram allowlist | per-tenant `.env` → `TELEGRAM_ALLOWED_USERS` | Tenant only responds to its owner |
| CORP-IDs in Hermes | `<tenant>-...` prefix | Per-tenant tagging on the JARVIS pipeline side |

### 4e. Shared services (what tenants DO share)

Defined in `/home/tagai/.openclaw-shared.env`, mounted into every tenant container via `env_file`:

| Resource | Why shared | Per-tenant scoping |
|---|---|---|
| Anthropic / DeepSeek / OpenAI / Google / Groq / Mistral API keys | Single account each, volume discounts | Quota tracked per-tenant via session logs |
| Telnyx SIP trunk (`TELNYX_*`) | Single carrier account, monthly minutes pooled | Per-tenant caller-ID until each brings its own DID |
| LiveKit Cloud | Single project | Room name prefix `room-<tenant>` keeps voice rooms namespaced |
| Supabase (`SUPABASE_*`) | Single project | RLS on `tenant_id` column |
| Microsoft Graph (`MS_*`) | Single Azure App Registration | All Gmail/Calendar/Drive calls hit one mailbox today (will split when needed) |
| Resend (`RESEND_API_KEY`) | Single account for outbound email | Per-tenant From: address |
| Apollo, Firecrawl, Tavily, Exa, Kie.ai, Cartesia, Deepgram, ElevenLabs (via Cartesia), Suno, Vapi, SimplyRETS, Twilio, etc. | One account each | API costs lump-summed |
| Vercel token | Single deploy account | Per-tenant Vercel project names |

### 4f. The backup pipeline

Two cron jobs run on the VPS:

- **03:00 UTC** — `/home/tagai/.openclaw/backups/backup.sh`
  - Tars `~/.openclaw/hindsight/`, `~/shared-projects/`, `~/openclaw-bootstrap/_template/`
  - Hot-backs `~/.openclaw/memory/main.sqlite` via Python sqlite3 API (WAL-consistent)
  - Writes to `~/.openclaw/backups/backup-YYYYMMDD-HHMMSS/`
  - Keeps last 7 days
- **03:30 UTC** — `/home/tagai/.openclaw/backups/sync-to-github.sh`
  - Encrypts the day's backup dir with `age` (recipient = `~/.openclaw/backups/.age-public.txt`)
  - Pushes as an orphan branch to `GusAI40/tagai-cloud-backups` (private GitHub repo)
  - The `age` private key at `~/.openclaw/backups/.age-key.txt` (mode 400) **MUST** be copied to 1Password separately, or all backups are unrecoverable

**Fixed 2026-05-22 evening** — historical context kept here because the fix matters more than once:

The original backup pipeline had two compounding bugs that surfaced on 2026-05-22:

1. **Per-tenant runtime configs were not captured.** Daily backup tar'd `hindsight/`, `shared-projects/`, `bootstrap-template/`, and `memory.sqlite` — but NOT `~/.openclaw/openclaw.json` (Gus's runtime config) or any `/home/tagai/tenants/<tenant>/.openclaw/` content. Hot-fixes to a tenant's `openclaw.json`, `auth-state.json`, or `sessions.json` lived only on the VPS disk + their in-place `.bak-<ts>` siblings.

2. **The off-site GitHub sync was silently failing.** `shared-projects.tar.gz` was 2.9 GB and GitHub has a ~99 MB per-file soft cap. The sync script detected "exceeds cap" and silently skipped each backup while logging "Sync complete". Last actually-pushed backup was 2026-05-19; nights 05-20, 05-21, 05-22-03:00 shipped zero bytes but cron showed success.

**The fix that's now live:**

- New `backup.sh` (canonical at `_tagai/scripts/backup.sh`, deployed to `/home/tagai/.openclaw/backups/backup.sh`):
  - REMOVED the 2.9 GB `shared-projects.tar.gz` tier. Those repos live in their own GitHub projects; the code is recoverable; per-tenant `.env` files are reproducible from `~/.openclaw-shared.env` + `bootstrap-tenant.sh`.
  - ADDED `runtime-configs.tar.gz` (~1.8 MB): `openclaw.json` + `auth-profiles.json` + `auth-state.json` + `models.json` + `sessions.json` + `HEARTBEAT.md` + `devices/` + `identity/` + per-tenant `docker-compose.yml` + per-tenant `.env` + the shared envs (`.openclaw-shared.env`, `.tagai-env`). Captured for Gus AND every `/home/tagai/tenants/*/`.
- New `sync-to-github.sh` (canonical at `_tagai/scripts/sync-to-github.sh`):
  - When any backup exceeds the size cap, the script exits **non-zero (rc=4)** instead of silently logging success. Cron records the run as failed.
  - Tracks per-run skipped-vs-pushed counts in the final summary line.
- Verified by manual run 2026-05-22 22:42 UTC: `backup-20260522-224145` (82 MB local, 49.5 MB encrypted) pushed successfully to `GusAI40/tagai-cloud-backups` as orphan branch `backup-20260522-224145`, commit `64f5311539ca7c58d0d40c1d61a6d945b661d0c1`. The three orphaned 2.9 GB backups (05-20, 05-21, 05-22-030001) were deleted locally because they contained no irreplaceable content.

**What's still on the wishlist (not blockers):**

- Migrate backup blobs from GitHub orphan branches to S3-compatible object storage (Hetzner Storage Box ≈ €3/month, no per-file cap) so the size guard becomes irrelevant.
- Add `~/.openclaw/openclaw.json.bak.*` retention pruning — backup files have started accumulating on disk.
- Add a "test restore" cron that monthly fetches one random encrypted backup, decrypts to /tmp, verifies sha256, then deletes. Otherwise we won't know recovery is broken until we need it.

## 5. The current fleet

| Tenant | Subdomain | Container | Port | Bot | Owner | Status |
|---|---|---|---|---|---|---|
| `gus` (primary) | openclaw.ubntag.com | openclaw-openclaw-gateway-1 | 18789 (public) | (Gus's) | gus@ubntag.com | Primary tenant; uses the legacy compose at `/home/tagai/openclaw/` not the bootstrap script |
| `julian` | julian.ubntag.com | openclaw-julian-gateway | 18884 (loopback) | @JujuJarvis_bot | julian@ubntag.com | Provisioned 2026-05-11 via `bootstrap-tenant.sh julian` |

Future tenants will all use the bootstrap-tenant path. Gus's primary container exists as legacy from before the multi-tenant pattern was extracted; it works and is left alone.

## 6. How a request flows (Telegram example)

1. User sends `hi` to `@JujuJarvis_bot` on Telegram
2. Telegram servers hold the message; Julian's gateway is polling via `getUpdates` long-poll
3. Gateway receives the message
4. Channel layer (`src/channels/telegram/`) checks the `TELEGRAM_ALLOWED_USERS` allowlist — Julian's user-id 8746285332 is on it, message passes
5. Gateway looks up the session for `agent:main:telegram:default:direct:8746285332` in `sessions.json`. If absent, creates a new session entry pointing at a fresh `.jsonl` file
6. Session is enqueued for `agent:main:main` lane (the embedded agent runtime)
7. Agent loads context: system prompt from `openclaw.json` → `agents.defaults.systemPromptOverride`, the `skillsSnapshot`, the conversation history from the session jsonl, the heartbeat config, the model defaults
8. Agent calls the primary LLM: `agents.defaults.model.primary` = `deepseek/deepseek-v4-flash`. Looks up the auth key in `agents/main/agent/auth-profiles.json` → `deepseek:default.key`. POSTs to `https://api.deepseek.com/v1/chat/completions`
9. If primary fails (404, billing, etc.), `auth-state.json` records the failure and the runtime tries the fallback chain: `google/gemini-2.5-flash-lite`, `anthropic/claude-haiku-4-5`, `anthropic/claude-sonnet-4-6`. Each failure type has a cooldown (`cooldownReason: format` = 90s, `disabledReason: billing` = much longer)
10. LLM responds; the agent may emit a tool call (e.g., `WebFetch`, `edit`, an MCP server call). If so, runtime executes the tool, feeds result back, loops until LLM emits a plain reply
11. Reply text goes back through the channel layer; gateway calls Telegram `sendMessage` to user 8746285332
12. The whole round-trip is logged to the session `.jsonl` and the `.trajectory.jsonl` for that session
13. If the agent gets stuck mid-loop, the `[health-monitor]` watchdog (`interval: 300s`) detects `stuck session` and SIGTERMs the gateway after 5 minutes. Docker's `restart: unless-stopped` brings it back. The same stuck session resumes on next boot unless something archives or repairs it (this caused the 2026-05-22 outage)

## 7. How to operate it (daily ops)

### 7a. Health checks

```bash
# from anywhere
curl -i https://openclaw.ubntag.com/healthz
curl -i https://julian.ubntag.com/healthz
# expected: HTTP 200, {"ok":true,"status":"live"}

# on the VPS
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect openclaw-julian-gateway -f '{{.State.Health.Status}}'
```

### 7b. Common operations

| Task | Command |
|---|---|
| SSH to box | `ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242` |
| Tail a tenant's logs | `docker logs openclaw-<tenant>-gateway --since 10m -f` |
| Restart a tenant (RIGHT way) | `cd /home/tagai/tenants/<tenant>/openclaw && docker compose up -d` |
| Restart a tenant (WRONG way — env_file won't reload) | ~~`docker restart openclaw-<tenant>-gateway`~~ |
| Inspect Telegram bot | `curl https://api.telegram.org/bot<TOKEN>/getMe` |
| Trigger backup now | `~/.openclaw/backups/backup.sh && ~/.openclaw/backups/sync-to-github.sh` (canonical sources: `_tagai/scripts/backup.sh` and `_tagai/scripts/sync-to-github.sh`) |
| Add a new tenant | `~/openclaw-bootstrap/bootstrap-tenant.sh <id> <subdomain.ubntag.com> <email>` |
| Tear down a tenant (archives, never deletes) | `~/openclaw-bootstrap/teardown-tenant.sh <id>` |
| List all tenants | `~/openclaw-bootstrap/list-tenants.sh` |
| Reload Caddy after Caddyfile change | `sudo systemctl reload caddy` |

### 7c. Common failure modes (with fixes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Tenant bot silent | Stuck session / heartbeat starvation / dead model id pinned in session | Archive `sessions.json` + session jsonl files; reset `auth-state.json` cooldowns; bump heartbeat interval. See 2026-05-22 session log. |
| 502 on `<tenant>.ubntag.com` | Gateway container down or unhealthy | `docker ps`; check container logs; `docker compose up -d` |
| `model_not_found` errors | Anthropic retired a model id, or `models.json` lists a wrong id | Update `agents.defaults.model.primary` + fallbacks in `openclaw.json`. Check Anthropic's "Did you mean…?" hints — they use dashes, not dots (`claude-haiku-4-5` not `claude-haiku-4.5`) |
| `disabledReason: billing` on a provider | API account out of credit | Top up; then clear `auth-state.json` lockout |
| Schema-clobber on container restart | Image version mismatch with `meta.lastTouchedVersion` | Bump `openclaw.json` → `meta.lastTouchedVersion` to match new image version BEFORE upgrade |
| Telegram `getUpdates` 409 conflict | Another poller using same token, OR your own `curl getUpdates` debug probes | Stop the duplicate; never probe `getUpdates` directly while gateway is polling |
| Container in restart loop | Health-monitor watchdog killing it | Tail logs for `stuck session` warnings; archive the stuck session pair |
| TLS cert error | Caddy didn't get a cert / hit Let's Encrypt rate limit | `sudo systemctl status caddy`; check `/var/log/caddy/`; new tenants must wait for Caddy to issue first cert (5–20 sec) |
| `TELEGRAM_BOT_TOKEN` missing inside container | Container recreated without env_file (e.g., `docker restart` instead of `docker compose up -d`) | `docker compose up -d` recreates with env_file properly mounted |

### 7d. Footguns (real incidents)

These are the recurring "I burned myself on this" lessons. Each one cost at least one debug session:

1. **`docker restart` is not `docker compose up -d`.** Bare `docker restart` reuses the existing container; if you've changed an env_file, the new value is NOT loaded. Always use `docker compose up -d` after env or compose changes. (Incident: 2026-05-17 Telegram outage)
2. **PowerShell `scp` cannot read `~/.ssh/config`** on Windows. Use the Bash tool or Git Bash for VPS file transfers. PowerShell will fail with a permission error.
3. **Audit scripts that `sed s/=.*/=<REDACTED>/`** match empty values too — they redact empty `.env` lines and make them look populated. For "is this key present" checks use `grep -E '^KEY=[^[:space:]]+'`.
4. **Probing Telegram `getUpdates` directly while the gateway is polling** causes 409 conflicts in gateway logs that look like a duplicate poller. The "duplicate poller" is you. Read gateway logs instead. (Incident: 2026-05-22 false-alarm)
5. **Schema-clobber on version mismatch.** If the running image's `package.json` version != `openclaw.json` → `meta.lastTouchedVersion`, the runtime snapshots existing config to `openclaw.json.clobbered.<ISO>` and writes fresh defaults, destroying per-tenant customization. Always bump `meta.lastTouchedVersion` BEFORE upgrading the image. `bootstrap-tenant.sh` bakes this in for new tenants.
6. **DNS for `ubntag.com` lives on Vercel, not Cloudflare.** Past confusion when adding subdomains. New tenant subdomains must be added in Vercel's DNS panel first.
7. **Symlinks across Docker bind-mounts don't work.** If you symlink a host file into a tenant volume, the container can't follow it. Use bind-mounts directly. (Incident: 2026-05-12 shared-projects)
8. **LLM auth lives in `agents/main/agent/auth-profiles.json`**, NOT in `DEEPSEEK_API_KEY` env var. The env var is a red herring. If the file is missing, the runtime fails over `deepseek → gemini` forever silently. Bootstrap step 8.5 seeds it.
9. **The off-site backup pipeline has lied about success before.** Until 2026-05-22 it silently skipped any file over GitHub's 99 MB cap while logging "Sync complete" — three nights shipped zero bytes before anyone noticed. The current script (`_tagai/scripts/sync-to-github.sh`) exits non-zero when any backup is skipped, so the cron job will be recorded as failed. When you next add a large new data tier to `backup.sh`, double-check the resulting tarball stays under the cap OR move that tier to a separate transport (S3 / Hetzner Storage Box). Trust the cron's exit code, not its log message.
10. **Stuck sessions are heritable across restarts.** A session that hangs in `state=processing` will resume on next boot and hang again. Archive the session files + remove the `sessions.json` pointer before restart, or the loop continues. (Incident: 2026-05-22)
11. **The heartbeat cron can starve channel responses.** `agents.defaults.heartbeat` puts a synthetic prompt into `agent:main:main` periodically. If the heartbeat takes longer than the watchdog timeout (5 min), the container restarts and Telegram messages queue without ever being processed. Keep `HEARTBEAT.md` empty unless you want active proactive work, and consider longer intervals. (Incident: 2026-05-22)

## 8. How to replicate from scratch

Recipe for spinning up your own Jarvis-AI-style fleet.

### 8a. Prerequisites (one-time, ~$25 + ~30 min)

1. **A VPS.** Hetzner CPX21 (~$15/month) is what we use. Equivalents work: Linode 4 GB ($24), DigitalOcean Premium 4GB ($24), Vultr 4 GB. Ubuntu 22.04 LTS, public IPv4.
2. **A domain.** Anything you can manage DNS for. We use `ubntag.com` on Vercel DNS, but Cloudflare / Namecheap / Route53 all work.
3. **A GitHub account** with two repos:
   - A fork of `openclaw/openclaw` (set up `tagai-main` branch — or your equivalent)
   - A private repo for encrypted backups (e.g., `<you>/tagai-cloud-backups`)
4. **API accounts** (start free where possible, top up as needed):
   - Anthropic (Claude API), DeepSeek (cheap fallback), Google (Gemini API)
   - Telnyx (SIP trunk, ~$1/month + per-minute), LiveKit Cloud (free tier OK)
   - Supabase (free tier OK initially)
   - Resend (email send, free tier OK)
   - One Telegram bot per tenant (free; `@BotFather`)
5. **An `age` keypair** for backup encryption: `age-keygen -o ~/.openclaw/backups/.age-key.txt`. **Copy the private key to 1Password.**

### 8b. Server prep (~15 min)

```bash
# As root, after SSH-ing to a fresh Ubuntu 22.04 box:
adduser tagai && usermod -aG sudo tagai
# Copy your SSH pubkey into /home/tagai/.ssh/authorized_keys
apt update && apt install -y docker.io docker-compose-v2 caddy age cron rsync git python3
systemctl enable --now docker caddy cron

# As tagai:
mkdir -p ~/tenants ~/tenants-archived ~/shared-projects ~/openclaw-bootstrap
sudo mkdir -p /etc/caddy/Caddyfile.d
sudo chown tagai:caddy /etc/caddy/Caddyfile.d
# Add ONE line to /etc/caddy/Caddyfile (once, ever):
#   import /etc/caddy/Caddyfile.d/*.conf
sudo systemctl reload caddy
```

### 8c. Pull the openclaw image (once per upgrade)

You can either build from source on the box or pull a published image. We build:

```bash
cd ~/openclaw  # this is your fork checkout on the box
git clone https://github.com/<you>/openclaw-1.git openclaw
cd openclaw && git checkout tagai-main
docker build -t openclaw:tagai .
# Read the resulting image version
docker run --rm --entrypoint=cat openclaw:tagai /app/package.json | grep '"version"'
# Note this version string; you'll bake it into per-tenant openclaw.json templates
```

### 8d. Set up shared services

```bash
# As tagai:
nano ~/.openclaw-shared.env
# Paste your API keys (ANTHROPIC_API_KEY, TELNYX_API_KEY, etc.). One per line.
# 50 lines is normal. Mode 600 owner tagai.
chmod 600 ~/.openclaw-shared.env
```

### 8e. Copy the bootstrap kit

```bash
# Copy ~/openclaw-bootstrap/ from our repo OR clone the tenant-bootstrap project:
cp -r ~/openclaw/_tagai/../openclaw-bootstrap ~/openclaw-bootstrap
# This contains bootstrap-tenant.sh, teardown-tenant.sh, _template/ etc.
```

### 8f. Provision your first tenant

```bash
# Add DNS A-record for <id>.<your-domain> → <vps-ip> FIRST (Vercel/Cloudflare/etc.)
~/openclaw-bootstrap/bootstrap-tenant.sh gus gus.example.com you@example.com
# Output: gateway port, gateway token (save it once!), container name, health-check result
```

The script does all the hard parts: renders `openclaw.json` with the correct `meta.lastTouchedVersion`, writes the per-tenant `.env`, generates a gateway token, allocates a deterministic port from `hash(tenant-id)`, writes the Caddy site block, reloads Caddy, brings the container up via compose, waits for health, prints the token. Total time: 60–90 seconds.

### 8g. Configure the tenant's first run

After bootstrap, edit two files for personality + Telegram:

- `/home/tagai/tenants/<id>/.openclaw/openclaw.json` → `agents.defaults.systemPromptOverride` (the assistant's persona) and `agents.defaults.model` (primary + fallbacks)
- `/home/tagai/tenants/<id>/openclaw/.env` → `TELEGRAM_BOT_TOKEN` (from BotFather) + `TELEGRAM_ALLOWED_USERS` (the owner's Telegram user-id, comma-separated for multiple)

Then: `cd /home/tagai/tenants/<id>/openclaw && docker compose up -d`. Within 60 seconds, message the bot — it should reply.

### 8h. Wire up backups

```bash
mkdir -p ~/.openclaw/backups
age-keygen -o ~/.openclaw/backups/.age-key.txt   # !!! COPY TO 1PASSWORD !!!
chmod 400 ~/.openclaw/backups/.age-key.txt
# Copy backup.sh + sync-to-github.sh from our repo (in tagai-cloud-backups bootstrap pack)
crontab -e
# Add:
#   0  3 * * * /home/tagai/.openclaw/backups/backup.sh         >> /home/tagai/.openclaw/backups/backup.log 2>&1
#   30 3 * * * /home/tagai/.openclaw/backups/sync-to-github.sh >> /home/tagai/.openclaw/backups/sync-to-github.log 2>&1
```

### 8i. You're live

Visit `https://<id>.<your-domain>/` — Caddy will issue a Let's Encrypt cert on first hit (takes ~5–20 sec). The gateway UI loads. Pair your browser via device-pair, type a message — your tenant responds.

## 9. Adapting for other use cases

The bones (multi-tenant runtime + shared services + per-tenant isolation) are use-case-agnostic. Most adaptation happens in three places per tenant:

| What changes | Where |
|---|---|
| The assistant's personality + role | `openclaw.json` → `agents.defaults.systemPromptOverride` |
| The skill set the assistant can invoke | Skills installed under `~/.openclaw/agents/main/skills/` (or shared `~/shared-projects/`) |
| The channels the assistant is reachable on | `openclaw.json` → `channels.*` (enable/disable Telegram, Slack, Discord, voice) and the corresponding bot tokens in `.env` |

Example adaptations:

- **Real estate concierge** (Michelle pattern): system prompt = listing agent persona; channels = Telegram + voice (Telnyx); skills = MLS lookup (SimplyRETS), CMA generator, Facebook-group poster
- **B2B sales SDR** (Spectrum/AT&T outreach): system prompt = SDR persona with industry context; channels = email (Resend); skills = Apollo contact lookup, Spectrum proposal generator, send-with-approval gate
- **Telecom proposal engine** (TAG E-Rate): system prompt = E-Rate consultant; channels = web UI only (no chat); skills = USAC pricing pull, RFP scraper, PDF generator
- **Personal AI assistant** (Gus's Jarvis): system prompt = "Jarvis for Gus"; channels = Telegram + voice + web; skills = all 100+ TAG skills
- **Voice-first dental receptionist** (BrightSmile demo): different runtime entirely (LiveKit agent process, not OpenClaw gateway), but lives on the same Hetzner box, uses the same shared LLM keys

The pattern that scales: don't fork the runtime per use case. Fork the **system prompt + skill stack** per tenant.

## 10. Costs (real numbers, 2026-05)

| Item | Monthly |
|---|---|
| Hetzner CPX21 | $15 |
| Domain (`ubntag.com`) | ~$1 (amortized annual) |
| Vercel DNS | $0 (free tier) |
| GitHub private repos | $0 (within free tier) |
| Anthropic API | usage-based, $5–$100 per tenant per month depending on chat volume |
| DeepSeek API | usage-based, $1–$20 per tenant (very cheap; primary for most tenants) |
| Telnyx SIP | $1/month + $0.007/min |
| LiveKit Cloud | free tier (10k participant-minutes/mo) |
| Supabase | free tier OK up to ~500MB / 50k MAU |
| Resend | free tier (3k emails/mo) |
| **Per-tenant marginal cost** | **$5–$30/mo** depending on usage |

A 10-tenant fleet on one CPX21 runs ~$100/month all-in including API usage at moderate volume. Compare to ~$2,000/month for the equivalent in commercial SaaS Jarvises ($200/seat × 10 seats).

## 11. Where to learn more (the rest of `_tagai/`)

| Read this | When you need to know |
|---|---|
| `_tagai/CLAUDE.md` | What Claude Code should and should NOT do when working in this repo |
| `_tagai/DEPLOY_HETZNER.md` | The exact deploy/redeploy procedure |
| `_tagai/HETZNER_PREFLIGHT.md` | What's installed on the box and its current state |
| `_tagai/CADDY_AUDIT.md` | The actual reverse-proxy config (Caddy on host) |
| `_tagai/ONBOARD_PLAYBOOK.md` | The interactive `openclaw onboard` flow |
| `_tagai/CHANNEL_STRATEGY.md` | Which channels are priority + why |
| `_tagai/CAPABILITIES.md` | Skill / tool inventory |
| `_tagai/HEALTH.md` | Health endpoints + status checks |
| `_tagai/scripts/backup.sh` | Canonical source for the VPS daily-backup cron (the fixed one) |
| `_tagai/scripts/sync-to-github.sh` | Canonical source for the VPS off-site-sync cron (fails loud, exits non-zero on skip) |
| `~/openclaw-bootstrap/README.md` (on the VPS) | The bootstrap script's contract + assumptions |
| `~/openclaw-bootstrap/HERMES-SWARM-EXTRACTION.md` | The full Hermes 3-layer swarm primitive — read alongside §13 below |
| `AGENTS.md` (repo root, upstream) | Upstream OpenClaw contributor rules |
| `CLAUDE.md` (repo root) | Upstream + TAG combined instructions |

## 12. Authoritative infrastructure reference

For machine-readable infra detail (server specs, network layout, DNS records, deployed services inventory), see:

- `C:\Users\gsanc\TAG-Projects-2026\_shared\docs\HETZNER_INFRASTRUCTURE.yaml`
- `_shared/docs/HETZNER_OVERVIEW_HUMAN.md`

These live outside this repo because they describe ALL TAG infrastructure, not just Jarvis AI.

## 13. Hermes swarm (designed, partly built, not fully deployed)

Hermes is the **agent-swarm primitive** that gives each tenant a "CTO + workforce" inside their own container. The canonical doc is `~/openclaw-bootstrap/HERMES-SWARM-EXTRACTION.md` on the VPS. This section is the elevator pitch; read the source doc for the wiring.

### What Hermes is (the design)

**Three concentric layers, one per tenant:**

| Layer | What | Where |
|---|---|---|
| 1. Runtime | Python 3.11 binary (`~/.local/bin/hermes`) with `state.db` (~19 MB), `kanban.db` (~100 KB), `config.yaml`, `SOUL.md` | Inside the per-tenant container at `~/.hermes/` |
| 2. Public chat proxy | Node shim on port 4000; fronts the floating-button chat widget on `<tenant>.ubntag.com/api/hermes/chat` | Per-tenant, Caddy-routed |
| 3. Skill bundle `hermes-army` | Markdown skills the runtime invokes | `workspace/.agents/skills/hermes-army/` |

**The IPC is kanban-as-message-bus.** Workers don't have a direct call interface. They poll a SQLite kanban board for tasks in `BACKLOG`, claim them, do work, write results back as task comments and flip status to `DONE`. The whole flow is replayable from kanban history, tenant-scoped by `tenant_id`, and the bottom of every skill carries a `TenantViolation` raise if it sees a foreign tenant_id in its output.

**The 100-agent corp** is 10 dept leads + 90 worker skill-tags. Every tenant gets the same shape, prefixed with their tenant-id:

| Dept lead | Skills |
|---|---|
| `<tid>-exec-lead` | research, decision-support, risk-mgmt, documentation |
| `<tid>-eng-lead` | software-dev, devops, testing |
| `<tid>-ai-lead` | mlops, prompts, data-science, autonomous-ai-agents |
| `<tid>-sales-lead` | sales-outreach, content, seo, social-media, analytics |
| `<tid>-cs-lead` | onboarding, support, account-mgmt, training, escalation |
| `<tid>-ops-lead` | sysadmin, networking, security, monitoring, backup |
| `<tid>-creative-lead` | video-gen (Seedance), image-gen, copywriting, brand-mgmt |
| `<tid>-data-lead` | data-engineering, analytics, bi-reporting, web-scraping |
| `<tid>-legal-lead` | contract-review, compliance, privacy, e-rate, ip-trademark |
| `<tid>-studio-lead` | cinematography, voiceover, music, post-production |

The 90 workers are NOT pre-spawned. They're skill TAGs in `corp-agent-roster.csv`. When a dept lead dispatches a task with `skill_tag=software-dev`, the `nano-spawner` skill matches it against the 6 software-dev workers under `eng-lead` (CORP-011..016), least-recently-used, spawns one, hands it the task.

### The 4 shipped `hermes-army` skills

In `/home/tagai/openclaw-bootstrap/_template/hermes-army/`:

| Skill | Purpose |
|---|---|
| `nano-spawner.md` | The swarm's `Promise.all()`. Every fan-out (analyze 100 leads, render 30 videos, send 1000 emails) goes through this single API. Where the `TenantViolation` gate lives. |
| `tenant-onboarder.md` | One-shot bring-up of the 10 dept leads + 90 worker bindings for a fresh tenant |
| `multi-platform.md` | Routes incoming tasks across Telegram / web / voice / CLI |
| `corp-dashboard.md` | Emits pulse events to a Supabase table for the `ubntag.com/ai-corp` dashboard |

### What's actually running vs. designed today

| Component | Status |
|---|---|
| Layer 1 — Hermes runtime in container | **Designed, not verified running** on any production tenant. Binary install path is `~/.local/bin/hermes` but I have not confirmed it's there on Julian's container. |
| Layer 2 — chat proxy on port 4000 | **NOT live.** The floating-button widget on `*.ubntag.com` calls a dead endpoint. The source doc itself says "the service isn't bound." |
| Layer 3 — `hermes-army` skills | Template exists. **NOT installed on Julian's tenant** — verified 2026-05-22: `ls /home/tagai/tenants/julian/.openclaw/hermes-army/` and `…/workspace/hermes-army/` both return "No such file or directory". `bootstrap-tenant.sh` is supposed to copy them; either it isn't, or Julian's bootstrap predates the skill-copy step. |
| 100-agent CSV rosters | Generated per-tenant by bootstrap — verified at `/home/tagai/tenants/julian/.openclaw/corp/` (board, c-suite, agent-roster, b2b-sales) |
| Pulse events → `ubntag.com/ai-corp` dashboard | **Designed, not live.** Dashboard route doesn't exist yet. Per-tenant data feed is produced by bootstrap but no consumer. |
| Per-tenant Supabase RLS by tenant_id | **Designed.** Bootstrap appends `SUPABASE_TENANT_FILTER=<tid>` to each tenant's env; verified that Julian's RLS policy is in place per the 2026-05-12 v3 session log. |

### Why Hermes is on the wishlist, not the critical path

OpenClaw alone (gateway + channels + LLM tool-use loop) is enough to give a tenant a working assistant. We can ship value to Julian without Hermes. Hermes is the *scale-up* primitive — when a single agent's loop isn't enough and you need 50 things happening in parallel (mass outreach, mass video render, mass data scrape), the kanban-driven fan-out becomes essential. Until a tenant hits that volume, the unhydrated `hermes-army` skills sit harmlessly in the template directory.

### Open Hermes architecture questions (from `HERMES-SWARM-EXTRACTION.md` §8)

1. **Single Telegram bot vs per-tenant bot?** Current: per-tenant (each tenant brings their own BotFather token). Alternative: one bot, allowlist routing. Per-tenant is safer; one-bot is cheaper.
2. **kanban.db consolidation for cross-tenant analytics?** Currently per-container. A nightly export to a read-only warehouse would enable platform-operator analytics without breaking isolation.
3. **Worker pool sharing across tenants?** Theoretically possible if you trust the `TenantViolation` gate. NOT recommended until that gate is independently audited.
4. **LiveKit room concurrency cap?** Shared LiveKit project may have a project-level cap. Hermes would need a global semaphore (Redis counter on host) before voice-mcp allocates a room.

---

**Last updated:** 2026-05-22 evening — added §13 Hermes section (you asked), refreshed §4f to reflect the new backup pipeline that actually works (vs. the broken state it described earlier today), updated footgun #9, added scripts/backup.sh + scripts/sync-to-github.sh to the references in §7b and §11.
