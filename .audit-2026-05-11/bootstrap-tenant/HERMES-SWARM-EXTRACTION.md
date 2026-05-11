# Hermes Swarm — Extraction of the Multi-Tenant Primitive

This doc explains the **swarm primitive** that `bootstrap-tenant.sh` materializes for every new tenant. It is the architectural distillation of what's currently running on the Hetzner VPS (`tagai-cloud`) for Gus's tenancy, generalized so any new tenant inherits the same shape with full isolation.

Source-of-truth files (all under `.audit-2026-05-11/`):
- `vps-snapshot/AI_CORPORATION_BLUEPRINT.md` — the 100-agent org design
- `hermes-swarm/HERMES.json` — the layered Hermes architecture observed in production
- `vps-snapshot/MULTI_TENANT_6000_CALL_SIMULATION.md` — the isolation requirements per tenant
- `drift/SCHEMA-RISK.json` — the `meta.lastTouchedVersion` schema-clobber gotcha

---

## 1. The Three-Layer Hermes Architecture

Hermes is **not** a single process. It is three concentric layers that together form one tenant's "CTO + workforce" stack.

### Layer 1 — Container Runtime (inside `openclaw-<TENANT_ID>-gateway`)
- **Location**: `/home/node/.hermes/` inside the per-tenant container
- **Binary**: `~/.local/bin/hermes` (Python venv, 3.11)
- **State**:
  - `state.db` (SQLite, ~19MB at maturity) — agent memory + session history
  - `kanban.db` (SQLite, ~100KB at maturity) — task queue + assignments
  - `config.yaml` (~12KB) — runtime config
  - `SOUL.md` — Hermes' identity/values for this tenant
- **Lifecycle**: `nohup hermes gateway --accept-hooks &` — supervised by Docker restart policy
- **Logs**: `/tmp/hermes-gateway.log` (rotated), `~/.hermes/logs/agent.log`, `~/.hermes/logs/spawn.log`
- **Model**: configurable per tenant via `HERMES_OPENAI_KEY` env (defaults to shared DeepSeek key)
- **Isolation invariant**: this entire layer is inside the per-tenant container — there is exactly ONE Hermes runtime per tenant, with its OWN kanban + state + memory.

### Layer 2 — Public Chat Proxy (host-side or container-side, port 4000)
- **Script**: `scripts/hermes-proxy.mjs` (small Node.js shim)
- **Job**: receive HTTP POSTs from public web UIs (e.g., `ubntag.com/hermes` floating-button widget), forward to Hermes' chat endpoint, stream the response back
- **Per-tenant version**: each tenant runs their own proxy on a tenant-scoped path: `https://{{DOMAIN}}/api/hermes/chat` (Caddy routes it to the right container)
- **Persona**: luxury-concierge tone, one-sentence answers, contact: tenant's owner_email
- **Status (current)**: NOT yet listening on the production VPS — the website calls it but the service isn't bound. Bootstrap should NOT depend on it being live; tenants work fine without it (Telegram + CLI still work).

### Layer 3 — Skill Bundle: `hermes-army`
- **Location (per tenant)**: `/home/tagai/tenants/<TENANT_ID>/workspace/.agents/skills/hermes-army/`
- **Currently shipped (4 skills)**:
  1. `corp-dashboard.md` — emit pulse events to `ubntag.com/ai-corp` (tenant-scoped)
  2. `multi-platform.md` — route tasks Telegram/web/voice/CLI
  3. `nano-spawner.md` — the canonical fan-out spawn API
  4. `tenant-onboarder.md` — one-shot bring-up of 10 dept leads + 90 worker bindings
- **Missing per blueprint**: 10 dept-lead kanban profiles + 90 worker skills (will materialize on first run of `tenant-onboarder` once Hermes is given a real LLM-backed kanban-write tool)

---

## 2. The Kanban-Task-as-Message Pattern

This is the **core IPC primitive** between Hermes and its workers. Workers don't have a direct call interface — they read tasks from a kanban board and write results back as task comments. This is what makes the swarm tractable: every call is auditable, replayable, and tenant-scoped by the column name.

### Task lifecycle
```
[BACKLOG] -> [ASSIGNED] -> [IN_PROGRESS] -> [REVIEW] -> [DONE]
                                                    \-> [FAILED] -> retry / escalate
```

### Task envelope
```json
{
  "task_id": "uuid",
  "tenant_id": "<TENANT_ID>",
  "parent_task_id": "uuid or null",
  "dept": "Engineering | AI & Research | ...",
  "lead": "<TENANT_ID>-eng-lead",
  "skill_tag": "software-dev",
  "title": "Refactor leadgen pipeline",
  "description": "...",
  "input": { /* arbitrary JSON payload */ },
  "deadline_utc": "2026-05-12T00:00:00Z",
  "created_by": "<TENANT_ID>-COO (Jarvis)",
  "assigned_to": null,
  "status": "BACKLOG",
  "comments": []
}
```

### How a fan-out works
1. Jarvis writes ONE parent task to dept `eng-lead`'s kanban: "Build feature X"
2. `eng-lead` Hermes profile breaks it into N child tasks, all tagged with same `parent_task_id`
3. `nano-spawner` skill scans for child tasks with status BACKLOG, spawns N nano-agents to ASSIGN+START them in parallel
4. Each worker writes its result as a comment with `status: DONE` on its assigned task
5. `eng-lead` polls until all children are DONE, aggregates results, writes parent's `comments[]` with the rollup
6. Jarvis polls the parent task, sees DONE, returns summary to Gus

The whole flow is replayable from kanban history. The whole flow is tenant-scoped by `tenant_id` — workers REFUSE to act on a task with a foreign tenant_id.

---

## 3. The 10 Dept-Lead Profiles (canonical names)

Every tenant gets these 10 named kanban profiles, all prefixed with their tenant_id at provision time. (E.g., for tenant `julian`, the profiles become `julian-exec-lead`, `julian-eng-lead`, etc.)

| Profile | Department | Required skills |
|---|---|---|
| `<tid>-exec-lead` | Executive | research, decision-support, risk-mgmt, documentation |
| `<tid>-eng-lead` | Engineering | software-dev, devops, testing |
| `<tid>-ai-lead` | AI & Research | mlops, content (prompts), data-science, autonomous-ai-agents |
| `<tid>-sales-lead` | Sales & Marketing | sales-outreach, content, seo, social-media, analytics |
| `<tid>-cs-lead` | Client Success | onboarding, support, account-mgmt, training, escalation |
| `<tid>-ops-lead` | Operations | sysadmin, networking, security, monitoring, backup |
| `<tid>-creative-lead` | Creative & Media | video-gen (Seedance), image-gen, copywriting, brand-mgmt |
| `<tid>-data-lead` | Data & Analytics | data-engineering, analytics, bi-reporting, web-scraping, data-quality |
| `<tid>-legal-lead` | Legal & Compliance | contract-review, compliance, privacy, e-rate, ip-trademark |
| `<tid>-studio-lead` | Hollywood Studio | creative-direction, cinematography, voiceover, music, post-production |

---

## 4. The 90 Workers (skill-tagged subagents)

The 90 non-permanent workers are NOT pre-spawned. They are skill TAGs that `nano-spawner` matches against when a task is dispatched. The mapping from CORP-ID to skill-tag is in `corp-agent-roster.csv`. Examples:

```csv
CORP-011,Frontend Engineer 1,Engineering,eng-lead,Subagent,software-dev
CORP-014,Backend Engineer 1,Engineering,eng-lead,Subagent,software-dev
CORP-017,DevOps Engineer 1,Engineering,eng-lead,Subagent,devops
CORP-021,LLM Specialist 1,AI & Research,ai-lead,Subagent,mlops
CORP-041,Outbound SDR 1,Sales & Marketing,sales-lead,Subagent,sales-outreach
```

When `eng-lead` needs to ship a backend feature, it dispatches a task with `skill_tag=software-dev`. `nano-spawner` picks one of CORP-011..016 (the 6 software-dev workers under eng-lead) by least-recently-used, spawns it, hands it the task, awaits the result.

After tenant ID prefixing: `julian-CORP-011`, `julian-CORP-014`, etc.

---

## 5. The `nano-spawner` as Canonical Parallel-Spawn API

Treat `nano-spawner` as the swarm's `Promise.all()`. Every fan-out — whether it's "analyze 100 leads", "render 30 videos", "send 1000 emails", "review 50 PRs" — goes through this skill.

### Why this matters for tenancy
- One API surface for all parallel work = one place to enforce tenant isolation
- The hard gate at the bottom of `nano-spawner.md` ("any worker whose output contains tenant_id != my own raises TenantViolation") is THE primary defense against cross-tenant data leakage
- Spawn metrics logged to `~/.hermes/logs/spawn.log` are per-tenant since the entire Hermes runtime is per-tenant — billing/quota analysis is straightforward

---

## 6. What a Fresh Tenant Inherits

After `./bootstrap-tenant.sh julian julian.ubntag.com julian@example.com` finishes:

```
/home/tagai/tenants/julian/
├── .gateway-token (mode 600, 64 hex chars)
├── openclaw/
│   ├── docker-compose.yml      (rendered from template)
│   └── .env                    (rendered + shared values appended)
├── .openclaw/                  (mounts to /home/node/.openclaw in container)
│   ├── openclaw.json           (rendered; meta.lastTouchedVersion=<runtime>)
│   ├── corp/
│   │   ├── corp-board.csv      (7 rows, IDs prefixed julian-BOD-*)
│   │   ├── corp-c-suite.csv    (8 rows, IDs prefixed julian-CEO-*)
│   │   ├── corp-agent-roster.csv (100 rows, IDs prefixed julian-CORP-*)
│   │   └── corp-b2b-sales.csv  (N rows, IDs prefixed julian-B2B-*)
│   ├── memory/                 (Hermes state.db will be created on first boot)
│   ├── credentials/            (Telegram pairing tokens will land here)
│   ├── identity/               (per-tenant SOUL files)
│   ├── secrets/                (empty; tenant can add tokens here)
│   ├── hindsight/              (logs)
│   └── backups/                (cron-driven daily config backups)
└── workspace/                  (mounts to /home/node/.openclaw/workspace)
    └── .agents/skills/hermes-army/
        ├── corp-dashboard.md   (tenant-parameterized)
        ├── multi-platform.md   (tenant-parameterized)
        ├── nano-spawner.md     (tenant-parameterized)
        └── tenant-onboarder.md (tenant-parameterized)
```

Plus:
- `/etc/caddy/Caddyfile.d/julian.conf` — Caddy site block for `julian.ubntag.com`
- Docker container `openclaw-julian-gateway` running, healthy, bound to 127.0.0.1:18837 (slot 37, deterministic from hash("julian"))
- A FRESH empty kanban inside the container (`kanban.db`)
- A FRESH empty state.db
- Tenant-scoped Supabase row-level security automatically applied (because every query Hermes makes from this tenant carries `SUPABASE_TENANT_FILTER=julian`)

---

## 7. Pulse Event Flow → `ubntag.com/ai-corp`

The `corp-dashboard` skill writes pulse events to a shared Supabase table `corp_pulse_events` with RLS keyed on `tenant_id`. The public dashboard at `ubntag.com/ai-corp` queries this table — but the user viewing it must be authenticated, and the RLS policy filters to only their tenant's rows.

Pulse events power:
- Real-time "X agents working" counter
- Department velocity chart (tasks completed / hour by dept)
- Stalled-task alerts
- Cost-per-task rollups (billed back to the tenant)

This flow is currently designed but NOT live — the dashboard route at `ubntag.com/ai-corp` is the next deliverable, and bootstrap-tenant produces the per-tenant data feed it will consume.

---

## 8. Open Architectural Questions (for follow-up)

1. **Single Telegram bot vs per-tenant bot?** Current design: per-tenant bot (each tenant brings their own BotFather token). Alternative: one bot, route by `allowed_users` array. Per-tenant is safer; one-bot is cheaper.
2. **kanban.db consolidation for analytics?** Currently each container has its own. A nightly export → consolidated read-only warehouse would enable cross-tenant analytics for the platform operator without breaking isolation.
3. **Worker pool sharing?** A skill like `software-dev` could theoretically draw from a shared worker pool across tenants if we trusted the TenantViolation gate. We do NOT recommend this yet — keep workers per-container until the hard gate is independently audited.
4. **LiveKit room concurrency cap?** Shared LiveKit project may cap simultaneous SIP participants at the project level. Hermes needs a global semaphore across all tenants — implement as a Redis-backed counter on the host, with each tenant's voice-mcp checking it before allocating a room.
