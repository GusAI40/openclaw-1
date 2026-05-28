# TAG / OpenClaw — Technical Architecture (City Writeups)

**Audit date:** 2026-05-27
**Companion:** `REPO_VISUAL_MAP.md` (the map), `RISK_REGISTER.md` (the dangers), `REVENUE_FLOW.md` (the money path).

Each city explains: **purpose**, **how it makes/protects money**, **streets** (modules), **houses** (services), **rooms** (configs), **workers** (agents/crons), **utilities** (external dependencies), **risks**, **recommended next action**.

---

## City A — Jarvis Runtime

### Purpose (plain English)

Jarvis is the brain. When a founder messages on Telegram, talks on voice, or types in the dashboard, the brain decides what to do and answers back. Each customer (called a *tenant*) gets their own brain in their own container, so one customer's brain getting overloaded doesn't take down anyone else's.

### How it makes/protects money

- **Today:** revenue is indirect — Jarvis is Gus's personal force multiplier and the demo for everything TAG sells. When it works, Gus ships faster across E-Rate, Spectrum, Michelle, and VoiceAI. When it dies, all those workstreams slow down.
- **Soon:** the same per-tenant pattern will host paying customers (each like Julian). Each tenant ≈ a SaaS seat.

### Streets (modules — TAG view only)

- `_tagai/docker-compose.tagai.yml` — overlay applied on top of upstream `docker-compose.yml` to set memory limits, restart policies, healthcheck `depends_on` so the CLI doesn't orphan in a dead netns when the gateway restarts (this was a real bug, see `_tagai/CLI_HEALTH_INVESTIGATION.md`).
- `_tagai/.env.tagai.example` — env-var reference (the actual `.env` lives on the box at `/home/tagai/openclaw/.env`, mode 600, NOT in git).
- Upstream `src/gateway/`, `src/agents/`, `src/channels/`, `src/plugins/` — we use them, we don't modify them.

### Houses (services running per tenant)

| Container | Purpose | Port |
|---|---|---|
| `openclaw-*-gateway` | HTTP + websocket gateway, agent runtime, channel orchestration | gateway 18789 (loopback), browser/control 18791 |
| `openclaw-*-cli` | CLI sidecar; shares the gateway's network namespace | (none — uses gateway's) |

### Rooms (configs that drive behavior, per tenant)

- `/home/tagai/.openclaw/openclaw.json` (Gus) and `/home/tagai/tenants/julian/.openclaw/openclaw.json` (Julian) — gateway config: model fallback chain, channels enabled, system prompt, heartbeat interval, allowed origins, trusted Cloudflare proxies.
- `agents/main/agent/auth-profiles.json` — **per-tenant LLM credentials, mode 600, NOT in git.** Without this file the runtime fails over `deepseek → gemini` forever. Seeded by `bootstrap-tenant.sh` step 8.5.
- `openclaw.json.meta.lastTouchedVersion` — must equal the running image's `/app/package.json` version on every boot, or the runtime clobbers the schema on first save. Currently pinned to `2026.4.25`.

### Workers (agents and crons inside the runtime)

- **Telegram poller** — long-polls Bot API. Confirmed live for both tenants 2026-05-27 after Julian fix.
- **Heartbeat cron** — Gus = 30m, Julian = 12h. Julian's was reduced from 30m to 12h on 2026-05-22 because the cron was claiming the `agent:main:main` lane every fire and starving real Telegram messages.
- **Health monitor** — 300s interval, will SIGTERM components that fail health checks.
- **Browser control** — `127.0.0.1:18791`, token auth, used by browser-using agents.
- **Memory-core dreaming cron** — disabled by default (logs "cron service unavailable" — benign).

### Utilities (external dependencies — see `PROVIDER_VALIDATION.md`)

DeepSeek, Anthropic, Google AI, OpenAI, Kie.ai, Telegram, Microsoft Graph (via MCP).

### Risks

- **R-1 Critical** — Gus main `openclaw.json` has DOTTED Claude model IDs in fallbacks (`claude-haiku-4.5`, `claude-sonnet-4.6`). Anthropic API rejects these. Today (2026-05-27) Google's image gen key is also expired and OpenAI hit a billing hard limit. If DeepSeek drains below the request floor or hits a rate limit, Gus's fallback chain has no working tail.
- **R-2 High** — Heartbeat cron / long-running agent loops can wedge `agent:main:main`. Already burned Julian today. Detection is in place (`[diagnostic] stuck session: ...`), recovery is manual.
- **R-3 Medium** — Schema-clobber lurks any time we bump the image. The `lastTouchedVersion` discipline is the only thing preventing it.
- **R-4 Medium** — `auth-profiles.json` is not version-controlled; if the VPS disk dies and the off-site backup is missing OR the age private key isn't in 1Password, this file is gone forever.

### Recommended next actions

1. Fix R-1 today: `sed -i 's/claude-haiku-4\.5/claude-haiku-4-5/g; s/claude-sonnet-4\.6/claude-sonnet-4-6/g' /home/tagai/.openclaw/openclaw.json` then `docker compose restart`. Verify with a manual fallback test.
2. Add a runtime gate: when loading `openclaw.json`, regex-validate model IDs and refuse boot if any fail `^(deepseek|google|anthropic|openai)/[a-z0-9-]+$`. Catches the next typo before it costs an outage.
3. Confirm age private key (`/home/tagai/.openclaw/backups/.age-key.txt`) is in 1Password under a recoverable vault, not only on the box.

---

## City B — Hetzner Deploy Layer

### Purpose (plain English)

This city is the *building* the brain lives in. The building has electricity (Caddy + TLS), plumbing (Docker + bind mounts), security guards (firewall + device-pair), and a janitor (cron-based backup). The building is intentionally simple: one VPS, no Kubernetes, no Coolify, no Traefik. Caddy on the host terminates TLS and proxies to Docker on loopback ports.

### How it makes/protects money

- **Direct cost:** ~€10/mo Hetzner VPS hosts everything.
- **Protection:** off-site age-encrypted GitHub backups protect every tenant's runtime state. One ransomware or disk failure ≠ business reset.
- **Upside:** the bootstrap pattern means new tenant onboarding is one script (`bootstrap-tenant.sh`). Sales-to-provisioning is minutes, not days.

### Streets

- DNS at Vercel (NOT Cloudflare — past sessions confused this).
- Caddy v2.11.2 on the host, configs at `/etc/caddy/Caddyfile.d/*.conf` (one per tenant + `brightsmile.conf` for the voice demo).
- Docker for the runtime, named volumes under `/home/tagai/.openclaw/` (Gus) and `/home/tagai/tenants/<id>/.openclaw/` (per-tenant).
- Bind mount `/home/tagai/shared-projects/{rescue-websites,awesome-design-md}` → `/home/node/.openclaw/shared/` in each tenant container. **Symlinks do not work** — Docker can't follow host symlinks across mount boundaries (footgun #12 from prior session).

### Houses

| Service | Where | What it does |
|---|---|---|
| Caddy | host systemd | TLS + reverse proxy |
| Docker | host systemd | container runtime |
| OpenClaw gateways/CLIs | Docker per tenant | the brain |
| Voice demo (`voice-agent-demo`) | host systemd units `brightsmile-token`, `brightsmile-agent` | LiveKit voice demo on :18080, separate repo |
| MCP servers | per-tenant Docker (currently configured-not-running for Julian) | mail, calendar, drive |

### Rooms (configs)

- `/home/tagai/openclaw/docker-compose.yml` + override + `_tagai/docker-compose.tagai.yml` — Gus compose.
- `/home/tagai/tenants/julian/openclaw/docker-compose.yml` — Julian compose (separate project, NOT the one Gus uses).
- `/home/tagai/openclaw-bootstrap/bootstrap-tenant.sh` — provisions a new tenant.
- `/etc/caddy/Caddyfile.d/*.conf` — one TLS block per host.
- `/home/tagai/.openclaw/backups/.age-key.txt` — backup decryption key (mode 400).

### Workers (crons)

- `backup.sh` — 03:00 UTC daily. Snapshots agent memory, per-tenant configs, hindsight, bootstrap template, memory.sqlite (WAL-safe). 7-day retention. Idempotent.
- `sync-to-github-split.sh` — 03:30 UTC. age-encrypts each backup, splits to 90MB chunks, pushes to orphan branches on `GusAI40/tagai-cloud-backups`.
- `auto-approve-julian-devices.sh` — every 30 seconds, auto-approves new device-pair fingerprints **for Julian's tenant only**. Single-factor. Do NOT enable for paying tenants without a stricter auth signal.

### Utilities

- Hetzner (VPS).
- Vercel (DNS for `ubntag.com` zone).
- Let's Encrypt (via Caddy).
- GitHub (backup target, private repo `GusAI40/tagai-cloud-backups`).

### Risks

- **R-5 High** — Single VPS. No HA, no warm standby. If Hetzner has a region outage, every Jarvis tenant + the voice demo go dark.
- **R-6 High** — Bootstrap-tenant script and shared-projects bind-mounts are tribal knowledge in `_tagai/ONBOARD_RUNBOOK.md` and `REPO-INTEGRATION-PLAN.md` (the latter is OUTSIDE this repo, on the box). Not codified as IaC.
- **R-7 Medium** — `auto-approve-julian-devices.sh` is a security relax for one tenant. If it accidentally got applied to a future paying tenant, it's a credential-stuffing attack vector.
- **R-8 Medium** — DNS is on Vercel — past sessions documented confusion with Cloudflare. If credentials to the Vercel DNS panel are lost, ANY new tenant subdomain (`*.ubntag.com`) blocks until DNS is restored.

### Recommended next actions

1. Document the off-site backup recovery drill (test once: pick a date, pull from GusAI40/tagai-cloud-backups, decrypt with age key, verify a tenant boots).
2. Promote `bootstrap-tenant.sh` into this repo under `_tagai/scripts/` (it currently lives only on the box at `/home/tagai/openclaw-bootstrap/`).
3. Add a Caddy-level deny rule for any tenant subdomain not in an explicit allowlist (defense against accidental DNS-only tenant creation).

---

## City C — Outbound Pipelines

### Purpose (plain English)

City A is reactive (it answers when spoken to). City C is *proactive* — these are the trucks that drive out of the state to do work for customers: email pipelines, MCP-bridged Microsoft tools, brand collateral. This is where TAG turns Jarvis from "neat AI assistant" into "outbound revenue generator."

### How it makes/protects money

- `rescue-websites-sim/` is the **safety net** for TAG's main outbound email pipeline. It catches three classes of bug *before* a live send (friendly fire, hard-vs-soft unsub, reputation burn).
- `mcp-servers/microsoft-graph/` is the bridge that lets Jarvis read/send mail + manage calendars on a customer's behalf — the foundation of an "executive assistant" tier.
- `_tagai/BRAND.md` + assets ensure every external deliverable is on-brand (Jarvis voice, palette, no em-dashes, no purple). This is the IP that makes TAG output distinct from generic AI agency output.

### Streets

- `rescue-websites-sim/` — standalone npm project (NOT in pnpm workspace). Mocks Google Places, Firecrawl, Resend, Cloudflare. Run with `npm run sim:smoke` (10 interactions) or `npm run sim:full` (1000 interactions, 2 tenants, 5 verticals, 90 days). Migration SQL `migrations/001-add-tenant-isolation.sql` is **proposed, not applied** — gated on sim validation.
- `mcp-servers/microsoft-graph/` — single MCP server today. 6 tools: `mail_search`, `mail_send`, `calendar_list_events`, `calendar_create_event`, `drive_list`, `drive_get_file`. Auth: Entra ID client-credentials.
- `_tagai/BRAND.md`, `_tagai/INTEGRATION.md`, `_tagai/CHANNEL_STRATEGY.md` — strategy docs.
- `_tagai/rescue-patch-2026-05-12/` — parked patches (src/outreach/email.ts, extract-email.ts, pipeline.ts) for the live rescue-websites pipeline. Not yet merged.

### Houses

- `rescue-websites-sim` simulator process — runs locally, writes to `sim-runs/<run-id>/`.
- `mcp-microsoft-graph` MCP process — registered via `openclaw.json:mcpServers`. **Currently configured-but-not-running for Julian** (configured by shared-services template, but Julian's tenant lacks the program files at `/home/tagai/tenants/julian/.openclaw/mcp-servers/` — only Gus has them under `/home/tagai/.openclaw/mcp-servers/`).
- Live rescue-websites pipeline lives in `/home/tagai/shared-projects/rescue-websites/` on the box (bind-mounted into all tenants). Not in this repo.

### Rooms (configs)

- `rescue-websites-sim/package.json` scripts, `migrations/001-add-tenant-isolation.sql`.
- `mcp-servers/microsoft-graph/src/index.mjs` + `package.json`.
- `_tagai/resend.json`, `_tagai/supabase-snippet.json` — reference snippets for the live pipeline.

### Workers

- **None on a schedule from this repo.** The live rescue-websites pipeline has its own cron, but it lives in the bind-mounted shared dir, not here.

### Utilities

- Microsoft Graph API (via MCP, Entra ID client-credentials).
- Resend (transactional email — for the live pipeline, mocked in the sim).
- Cloudflare Pages (Julian deployed `rescue-websites.pages.dev` via `wrangler` / `gh` today).
- Google Places API (mocked in the sim, presumed live in the pipeline).
- Firecrawl (mocked in the sim).
- Supabase (data layer, shared across tenants — design problem the sim is built to surface).

### Risks

- **R-9 High** — `rescue-websites-sim` IDENTIFIED three structural bugs in the live pipeline (friendly fire, unsub-vs-snooze, reputation burn) but the live pipeline still runs without those fixes. The sim is doing its job; the human follow-up isn't.
- **R-10 Medium** — Julian's MCP servers are configured-but-not-running. He has a `mcpServers` block in `openclaw.json` but no program files at `/home/tagai/tenants/julian/.openclaw/mcp-servers/`. Either ship them or remove the config — current state is misleading (looks healthy in logs).
- **R-11 Medium** — `_tagai/rescue-patch-2026-05-12/` has been sitting un-merged since 2026-05-12. Either land it or delete it — stale patch directories rot.
- **R-12 Low** — `_tagai/webhook-handler.mjs` and `webhook-handler-current.mjs` are identical 318-line files. Pick one, delete the other.

### Recommended next actions

1. Run `npm run sim:full` once with a known-bad scenario, confirm all 3 blindspots get flagged. Use the result as the gating evidence to apply `migrations/001-add-tenant-isolation.sql` to the live Supabase project.
2. Decide on MCP for Julian: either bind-mount `/home/tagai/.openclaw/mcp-servers/` into Julian's tenant, or remove the dead config from his `openclaw.json` so logs are honest.
3. Diff `_tagai/rescue-patch-2026-05-12/` against the live `/home/tagai/shared-projects/rescue-websites/` — land what's good, delete the rest.

---

## What lives in this repo but is NOT TAG-critical

- The 120+ extensions under `extensions/` — upstream OpenClaw plugins (Discord, Slack, WhatsApp, Matrix, Feishu, etc.). TAG uses some, owns none. If a TAG bug points into one of these, fix upstream and pull.
- The `apps/` macOS/iOS/Android companions — upstream UI surfaces, not yet a TAG product.
- The `Swabble/` example app — upstream demo.
