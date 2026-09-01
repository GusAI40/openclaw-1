# TAG AI Infrastructure Audit — 2026-05-11

**Surface audited:** Hetzner VPS `tagai-cloud` (87.99.148.242) + GitHub `GusAI40/openclaw-1` + local workspace `openclaw-4-25-26` + container-internal Hermes runtime
**Performed by:** Swarm of 4 atomic agents (services-cataloger, drift-auditor, state-auditor, templater) + 1 synthesizer
**Goal:** ground truth for 100x tenant replication

---

## TL;DR

You have **8 production services**, **1 swarm runtime (Hermes)** that's already running inside the openclaw container, and a **100-agent corporation design** that's only 3% built. The compose file is already parameterized for multi-tenant. The blocker isn't architecture — it's hygiene:

1. **The openclaw.json clobber mystery is solved.** Gateway boot does an equality check on `meta.lastTouchedVersion`; on mismatch it snapshots config to `.clobbered.*` and writes defaults. Fix = bump that string before `docker compose up`. Schema is purely additive — no breaking changes ever happened.
2. **Three `/opt/` apps are squatters.** `michelle-cma`, `tour-book`, `voiceai` were `scp`d from Gus's Windows laptop (UID 197609), have no `.git`, no rollback, no review trail. Any laptop save silently overwrites prod.
3. **Grammy patch is unbacked.** The openclaw image is currently running a patched build (`grammy@^1.42.0` for Telegram) that exists only as a sidecar Dockerfile. Next clean rebuild = Telegram dies. Same bug as the May 7 incident.
4. **GitHub PATs leak in 5 of 7 workspace repo remotes** on the VPS. Drift-auditor caught it. Rotate now.

Two **orphan Caddy routes** (michelle-fb, michelle-fb-status) return 502/break — either start the services or remove the routes. Zero **backups** of the 253MB of agent memory (hindsight + memory/main.sqlite) — silent data-loss exposure.

The 100x replication template (`bootstrap-tenant/`) is being built by the templater agent right now. The runbook agent is writing the operator playbook. When those return, the audit deliverables are complete.

---

## Inventory

### Service stack (6 live + 1 exited)

| ID | Runtime | Image / Source | Ports | Caddy host | Health | Source of truth |
|---|---|---|---|---|---|---|
| openclaw-gateway | Docker | `openclaw:tagai` (== grammy build) | 18789, 18790 | openclaw.ubntag.com | healthy 4h | `/home/tagai/openclaw/docker-compose.yml` |
| openclaw-cli | Docker | (sidecar, on-demand) | — | — | exited 0, 4d | shares compose |
| tour-book | Docker | `tour-book-tour-book` | 8001 (container-only) | — (broken route ref) | healthy 4d | `/opt/tour-book/` (UID 197609 ⚠) |
| michelle-cma | Docker | `michelle-cma-cma-server` | 8080 | cma.ubntag.com | healthy 4d | `/opt/michelle-cma/` (UID 197609 ⚠) |
| jarvis-vapi-webhook | systemd | `/opt/jarvis-vapi/webhook-handler.mjs` | 18792 (lo) | openclaw.ubntag.com `/vapi/*` | running | `/etc/systemd/system/jarvis-vapi-webhook.service` |
| voiceai-server | PM2 (root) | `/opt/voiceai/server/server.js` | 3000 | voiceai.ubntag.com | online 4d | `/opt/voiceai/` (UID 197609 ⚠) |
| Hermes (inside openclaw) | embedded | `~/.local/bin/hermes` (Python 3.11) | n/a (gateway via openclaw) | n/a | runs in container | `/home/node/.hermes/` |

See `.audit-2026-05-11/services/SERVICES.json` and `ROUTES.json` for full schemas, mounts, env-var inventories.

### The swarm primitive (Hermes — 3 layers, already running)

| Layer | What | State |
|---|---|---|
| 1 — Container runtime | `~/.hermes/` inside openclaw (Python SWE-bench env, 26 skills, kanban.db, state.db 19MB, 22 env vars, DeepSeek primary, OpenRouter fallback) | live |
| 2 — Public chat proxy | `hermes-proxy.mjs` on :4000 (NodeJS, DeepSeek-chat persona = TAG AI concierge) | code present, not listening on host (probably only inside container) |
| 3 — Hermes-army skills | `corp-dashboard`, `multi-platform`, `nano-spawner` | 3 of 100 designed (97 missing) |

See `.audit-2026-05-11/hermes-swarm/HERMES.json` for full layer-by-layer breakdown.

### 100-agent corporation (design vs reality)

Per `AI_CORPORATION_BLUEPRINT.md` (designed 2026-05-10):
- Board of 7 (Gus + 6 AI oracles)
- C-Suite of 8 (Gus + Jarvis-COO + Hermes-CTO + 5 oracles)
- 10 departments × 10 agents = 100 workers (10 dept-leads + 90 specialists)

Per CSVs on disk: 8 C-suite rows, 7 board rows, 49 of 100 agent-roster rows, 30 B2B sales rows. **The roster is half-filled; the workforce is unspawned.**

---

## Drift map

### `/opt/` UID-197609 squatters (P0)
```
/opt/michelle-cma/ → no .git → laptop copy → running michelle-cma container ⚠
/opt/tour-book/    → no .git → laptop copy → running tour-book container ⚠
/opt/voiceai/      → no .git → laptop copy → root PM2 voiceai-server ⚠
/opt/jarvis-vapi/  → owned by tagai → systemd unit (this one is fine)
```
**Risk:** Any save in `C:\Users\gsanc\...` to one of these app trees that gets synced (OneDrive, manual rsync, etc.) silently mutates production. There is no rollback. There is no review.

### Grammy patch out-of-band (P0)
```
openclaw:tagai-pre-grammy  ←  openclaw:tagai-grammy  ←  openclaw:tagai (running, == grammy)
                            │
                            └── /home/tagai/openclaw-grammy-patch/Dockerfile installs grammy@^1.42.0
```
The running image IS the grammy build (same SHA `29571e8eeb29` as `:tagai-grammy`). But grammy is NOT in any committed `package.json`. Next clean rebuild drops it and Telegram alerts die. **Bake into package.json.**

### Two-way Windows ↔ VPS drift (P1)
- **VPS has 3 commits not on local:** `cbf1103` (Caddy deploy docs), `c6c636d` (Telegram alerts), `36d7b2e` (TAG AI overlay) — high-value work only on the box.
- **Windows has 18+ untracked `_tagai/` scripts** not on VPS.
- Fix: `git fetch && git pull --rebase` on Windows to claw back the VPS commits, then commit + push the local-only files.

### GitHub PATs in workspace remotes (P0 SECURITY)
5 of 7 repos under `/home/tagai/.openclaw/workspace/` have PATs embedded in `git remote origin` URLs. Anyone with read access to those dirs has those tokens.

See `.audit-2026-05-11/drift/DRIFT.json` for full per-service drift state and remediation order.

---

## State surface

### Persistent value (must back up)

| Path | Size | Re-creatable? | Currently backed up? |
|---|---|---|---|
| `.openclaw/hindsight/` | 233 MB | No (long-term agent memory) | **No** ⚠ |
| `.openclaw/memory/main.sqlite` | 20 MB | No (primary DB) | **No** ⚠ |
| `.openclaw/openclaw.json` | 10 KB | No (gateway config) | Has 14 backups in same dir; no offsite |
| `.openclaw/kanban.db` (in container) | 102 KB | No (workforce state) | No |
| `.openclaw/credentials/` + `.openclaw/secrets/` | small | No | No |
| `.openclaw/workspace/*` (minus node_modules) | ~1 GB | Yes (git clone) | No, but recoverable |
| `.openclaw/workspace/node_modules` | ~5.7 GB | Yes (`pnpm install`) | n/a — don't back up |

`/home/tagai/.openclaw/backups/` exists as an **empty 4 KB directory with no cron writing to it**. See `.audit-2026-05-11/services/DATA.json`.

### Secret consolidation

20 `.env` files VPS-wide. `ANTHROPIC_API_KEY` in 4 places, `MS_CLIENT_SECRET` in 4, `RESEND_API_KEY` in 5 (also duplicated as `/secrets/resend.token`). Rotation today = 4–5 file edits. Should be 1.

**Recommendation (per state-auditor):** Collapse to 2 canonical files (`/home/tagai/.tagai-env` for shell-level, `/home/tagai/.openclaw/.env` for container-level) + symlinks for per-service consumers. Use 1Password as canonical source. Delete the two stale `.env.bak.*` files (both > 2 weeks old).

See `.audit-2026-05-11/services/SECRETS.json`.

---

## openclaw.json schema clobber — root cause SOLVED

Per `.audit-2026-05-11/drift/SCHEMA-RISK.json`:

**Mechanism:** Gateway runtime, on boot, checks `meta.lastTouchedVersion` against its own version. On mismatch:
1. Snapshots existing config to `openclaw.json.clobbered.<ISO-timestamp>`
2. Writes fresh defaults (losing agents, channels, plugins, MCP config)
3. Reports a 502/1006/ERR_INVALID_RESPONSE externally because the gateway crash-loops trying to reconcile

**Forensic finding:** All 6 May 2–6 `.clobbered.*` files have IDENTICAL `meta.lastTouchedVersion = 2026.4.27` and `lastTouchedAt = 2026-05-01T05:14:00`. **That means you restored the same old config 6 times and restarted without updating the version string.** 6 failed boot attempts.

**Fix (1 line):** Before `docker compose up`, set the version string to match the new image. The schema diff between bak.4 (2026.4.25, 5803 bytes) and last-good (2026.5.6, 9633 bytes) is **purely additive** — new sections (`tools`, `channels.discord`, `tools.web`) appeared, nothing was renamed or removed. **There has never been a breaking schema change.** The only breaking thing is the equality check.

The full 10-step safe-upgrade procedure is in `.audit-2026-05-11/drift/SCHEMA-RISK.json` and will be in the RUNBOOK.

---

## Priority queue (the next 24 hours)

| # | Action | Why | Effort | Owner |
|---|---|---|---|---|
| 1 | **Rotate the 5 leaked GitHub PATs.** Rewrite workspace remotes to use SSH (`git remote set-url origin git@github.com:...`). | Active credential exposure. | 30 min | Gus + me |
| 2 | **Bake grammy into openclaw package.json + rebuild image.** Tag as `openclaw:tagai-2026.5.11`. Bump `meta.lastTouchedVersion` to `2026.5.11`. Restart gateway. | Next clean rebuild kills Telegram. | 1 hr | me |
| 3 | **Init+push michelle-cma, tour-book, voiceai to GitHub.** Then redeploy on VPS via `git clone`, chown to `tagai:tagai`, retire `/opt/*` UID-197609 copies. | No rollback today. Laptop edits leak to prod. | 2 hr | me |
| 4 | **Fix the 2 orphan Caddy routes.** Either start the missing services or remove the routes. | They return 502 to anyone who tries them. | 15 min | me |
| 5 | **Wire backup cron.** Hourly sqlite + config + credentials → `.openclaw/backups/hourly/`. Daily hindsight + workspace-minus-node_modules → daily/. Weekly offsite rsync to Hetzner Storage Box. | 253MB of agent memory is one disk failure from gone. | 1 hr | me |
| 6 | **Pull the 3 VPS-only commits back to Windows.** `git fetch && git pull --rebase origin tagai-main`. Then commit the 18 untracked `_tagai/` scripts. | Two-way drift. | 15 min | Gus |
| 7 | **Apply bootstrap-tenant template** (waiting on templater agent) to provision Julian as test tenant on `julian.ubntag.com`. | Proves the 100x rinse-repeat works. | 45 min | me |
| 8 | **Wire ai-corp dashboard to public URL.** `corp-dashboard` skill exists but the page is not deployed. | Visible activity = trust + accountability. | 2 hr | me |

After 1–8, the box is hardened, replication is proven, and we can shift focus to building the 97 missing worker skills.

---

## Path to 100x

The math:
- 1 openclaw container ≈ 500 MB idle / 1.5 GB under load
- CPX21 (current): 8 GB RAM → ~5 tenants comfortably
- CPX41 (~$30/mo): 32 GB RAM → ~20–25 tenants
- CPX51 (~$60/mo): 64 GB RAM → ~40–50 tenants
- 100 tenants = 2–3 CPX51 hosts behind a load balancer + shared Caddy / Cloudflare + shared Telnyx/LiveKit/Supabase pool

Cost ceiling for 100 tenants: ~$200–300/month infrastructure + per-tenant LLM consumption (shared pool with per-tenant quotas).

What changes architecturally vs today:
- **Caddy: import pattern** — `/etc/caddy/Caddyfile.d/<tenant>.conf` per tenant (already supported by the existing Caddyfile structure)
- **DNS: wildcard** `*.ubntag.com` → tagai-cloud (or load balancer)
- **Container naming:** `openclaw-<tenant_id>-gateway` instead of `openclaw-openclaw-gateway-1`
- **Volume scoping:** `/home/tagai/tenants/<tenant_id>/{openclaw,workspace}` per tenant
- **Port allocation:** deterministic hash → port 18800+N gateway, 19000+N bridge
- **Secrets:** shared `${SHARED_*}` (Telnyx, LiveKit, etc.) + per-tenant `{{TENANT_*}}` (gateway token, possibly DeepSeek key if per-tenant billing)
- **kanban.db:** per-tenant inside each container — naturally isolated
- **Hermes:** per-tenant instance — runs inside each container, gets fresh state

Per `MULTI_TENANT_6000_CALL_SIMULATION.md`, the per-user-room pattern (`room-gus`, `room-julian`) is the right primitive for voice. Adopt it for openclaw too: `openclaw-<tenant>-room` = the tenant's brain.

---

## Audit deliverables

```
.audit-2026-05-11/
├── MASTER-AUDIT.md                           ← this file
├── vps-snapshot/                              ← raw artifacts pulled from VPS (timestamped)
│   ├── AI_CORPORATION_BLUEPRINT.md
│   ├── ARCHITECTURE_AUDIT_2026-05-07.md
│   ├── MULTI_TENANT_6000_CALL_SIMULATION.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── UNIFIED_ARCHITECTURE.md
│   ├── Caddyfile.vps
│   ├── jarvis-vapi.service
│   ├── openclaw-compose.yml
│   ├── openclaw-compose.override.yml
│   ├── openclaw.json.redacted                ← gateway config, no secrets
│   ├── corp-{agent-roster,c-suite,board,b2b-sales}.csv
│   └── hermes-army-skills/{corp-dashboard,multi-platform,nano-spawner}.md
├── services/
│   ├── SERVICES.json                          ← 6 runtimes, ports, mounts, healthchecks
│   ├── ROUTES.json                            ← Caddy routes + 2 orphans flagged
│   ├── SECRETS.json                           ← 20 .env files, vars only, dup map
│   └── DATA.json                              ← 36 persistent dirs, sizes, backup status
├── drift/
│   ├── DRIFT.json                             ← per-service GH↔VPS↔local state
│   └── SCHEMA-RISK.json                       ← openclaw.json clobber forensics + safe-upgrade
├── hermes-swarm/
│   └── HERMES.json                            ← 3-layer swarm runtime breakdown
├── bootstrap-tenant/                          ← (in-progress, templater agent)
│   └── ... (bootstrap-tenant.sh, _template/, teardown-tenant.sh, list-tenants.sh, HERMES-SWARM-EXTRACTION.md)
└── runbook/                                   ← (in-progress, runbook agent)
    └── RUNBOOK.md
```

---

## What didn't fit in this audit (open items)

- **The 33 workspace sub-projects** — each one deserves its own provenance check (which are active, which are stale, which need to come into the bootstrap template). Spawn a workspace-cataloger agent later.
- **Hindsight Python service** — runs on 5433 inside the container per `startup.sh`. Its data store + schema are not catalogued here.
- **LiveKit voice channel for Hermes multi-platform skill** — pending credentials per the skill markdown. Either wire it or document the dependency.
- **Cron consolidation** — only one cron line exists (`*/5 openclaw-healthcheck.sh`); but the runbook proposes backup crons. Verify they don't conflict.
- **Cloudflare configuration** — Caddy supports both proxied and direct paths but we didn't validate Cloudflare API/DNS state.
- **n8n Cloud** — referenced in the 2026-05-07 audit (1 active workflow: Vapi Transfer Handler). State not re-verified.
