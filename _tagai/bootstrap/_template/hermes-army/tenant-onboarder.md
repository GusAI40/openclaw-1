# Skill: Tenant Onboarder (tenant: {{TENANT_ID}})
# Self-improving: After each onboarding run, refines the dept-lead spawn order.
# Scope: One-shot bring-up of the 10 dept leads + 100 worker profiles for tenant `{{TENANT_ID}}`.

## Description
After `bootstrap-tenant.sh` provisions the container and roster CSVs, this skill is the first thing Hermes runs to materialize the actual kanban profiles and skill bindings for tenant `{{TENANT_ID}}` ({{TENANT_NAME}}).

## What it does

### Step 1 — Spawn 10 dept-lead kanban profiles
Reads `/home/node/.openclaw/corp/corp-agent-roster.csv` and creates one persistent kanban profile per unique `Lead` value:

| Profile name | Department | Reports to | Mandate |
|---|---|---|---|
| {{TENANT_ID}}-exec-lead | Executive | Jarvis | Strategy, decision support, board reporting |
| {{TENANT_ID}}-eng-lead | Engineering | Hermes | Frontend, backend, DevOps, QA |
| {{TENANT_ID}}-ai-lead | AI & Research | Hermes | LLM, prompts, agent frameworks, evals |
| {{TENANT_ID}}-sales-lead | Sales & Marketing | CMO Oracle | SDR, content, SEO, social |
| {{TENANT_ID}}-cs-lead | Client Success | Jarvis | Onboarding, support, account mgmt |
| {{TENANT_ID}}-ops-lead | Operations | Hermes | Sysadmin, network, security, monitoring |
| {{TENANT_ID}}-creative-lead | Creative & Media | CMO Oracle | Video, design, copy, brand |
| {{TENANT_ID}}-data-lead | Data & Analytics | CDO Oracle | Data eng, BI, scraping, quality |
| {{TENANT_ID}}-legal-lead | Legal & Compliance | CLO Oracle | Contracts, privacy, E-Rate, IP |
| {{TENANT_ID}}-studio-lead | Hollywood Studio | CMO Oracle | Cinematic content via Seedance/TTS |

Each lead is created with:
- a kanban board scoped to its department
- access to the 9–10 workers tagged with that lead's name in `corp-agent-roster.csv`
- a SOUL.md derived from the department's mandate
- a per-lead skill bundle reference (loaded lazily on first task)

### Step 2 — Register 90 worker skill bindings
For every row in `corp-agent-roster.csv` where `Type == Subagent`, register a worker binding:
- `worker_id`: `{{TENANT_ID}}-CORP-NNN`
- `dept`: the `Department` column
- `lead`: the `Lead` column
- `skill_tag`: the `Skill` column (e.g., `software-dev`, `research`, `mlops`)

Workers are NOT spawned during onboarding — they're spawned on demand by `nano-spawner` when a matching task arrives in the kanban.

### Step 3 — Self-test
- Submit a hello-world task to each dept lead (`"Acknowledge readiness for tenant {{TENANT_ID}}"`)
- Wait for all 10 acknowledgments
- If any lead fails to ack within 30s, log the failure and continue (do NOT block bootstrap)
- Emit a single `corp-dashboard` pulse event summarizing onboarding outcome

## Hard Gates
- All 10 leads MUST carry tenant_id="{{TENANT_ID}}" in their kanban metadata
- A lead created for another tenant_id (e.g., copy-paste error) MUST be rejected
- The onboarding run logs to `/home/node/.openclaw/hindsight/tenant-onboarding-{{TENANT_ID}}.log`

## Usage
```bash
docker exec -it openclaw-{{TENANT_ID}}-gateway hermes -s tenant-onboarder \
  -z "Bring up the 10 dept leads for tenant {{TENANT_ID}}"
```

Run once at provision time. Re-running is idempotent (existing profiles are reused, not recreated).
