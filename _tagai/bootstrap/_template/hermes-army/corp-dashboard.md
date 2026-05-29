# Skill: Corp Dashboard Syncer (tenant: {{TENANT_ID}})
# Self-improving: Updates department KPIs based on task completion
# Scope: This skill emits pulse events tagged with tenant_id="{{TENANT_ID}}" ONLY.

## Description
Syncs kanban activity for tenant `{{TENANT_ID}}` ({{TENANT_NAME}}) to the live AI Corporation dashboard at https://ubntag.com/ai-corp.

## Data Flow
1. Hermes (running inside openclaw-{{TENANT_ID}}-gateway) completes a kanban task
2. Skill creates a pulse event with `tenant_id="{{TENANT_ID}}"`
3. Pulse event written to Supabase table `corp_pulse_events` (RLS filters by tenant_id)
4. Dashboard API reads pulse events filtered by the requesting user's tenant_id
5. Public website displays live agent activity scoped to the viewer

## Pulse Event Schema
```json
{
  "tenant_id": "{{TENANT_ID}}",
  "agent_id": "{{TENANT_ID}}-CORP-NNN",
  "department": "Engineering | AI & Research | ...",
  "task_id": "kanban-task-uuid",
  "event": "started | progress | completed | failed",
  "timestamp_utc": "2026-05-11T12:34:56Z",
  "summary": "one-line human-readable summary",
  "metadata": { "duration_ms": 0, "tokens_used": 0, "cost_usd": 0.0 }
}
```

## Auto-Optimization
- Tracks task completion velocity per department (per tenant)
- Flags stalled tasks automatically (no progress > 10 min)
- Suggests reassignments for blocked items via kanban-task comments
- Logs to `/home/node/.openclaw/hindsight/dashboard-sync.log`

## Hard Gate
NEVER emit a pulse event with a `tenant_id` other than `{{TENANT_ID}}`. Cross-tenant emission is treated as a critical bug and blocks the spawn loop until restart.
