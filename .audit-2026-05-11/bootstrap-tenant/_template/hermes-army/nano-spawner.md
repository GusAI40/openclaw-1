# Skill: Nano-Agent Spawner (tenant: {{TENANT_ID}})
# Self-improving: Every 10 spawns, optimize batch size and timing.
# Scope: All spawned subagents inherit tenant_id="{{TENANT_ID}}" and CANNOT escape it.

## Description
Canonical parallel-spawn API for tenant `{{TENANT_ID}}`. Spawn N nano-agents to fan out a batch task (analyze repos, score leads, render videos, send 1000 personalized emails, etc.).

## Usage
```bash
docker exec -it openclaw-{{TENANT_ID}}-gateway hermes -s nano-spawner \
  -z "Spawn 10 agents to analyze repos in workspace/dialer-leads/"
```

## Worker Contract

### Input JSON (passed to each spawned worker)
```json
{
  "tenant_id": "{{TENANT_ID}}",
  "task_id": "uuid-of-parent-task",
  "worker_id": "{{TENANT_ID}}-CORP-NNN",
  "input": { /* the slice of work this worker owns */ },
  "deadline_utc": "2026-05-11T13:00:00Z",
  "callback_url": "http://127.0.0.1:18789/spawn-callback/<task_id>/<worker_id>"
}
```

### Output JSON (returned by the worker)
```json
{
  "worker_id": "{{TENANT_ID}}-CORP-NNN",
  "status": "success | partial | failure",
  "output": { /* worker-specific result */ },
  "metrics": {
    "duration_ms": 0,
    "tokens_used": 0,
    "cost_usd": 0.0,
    "tool_calls": 0
  },
  "error": null
}
```

### Error format (when status="failure")
```json
{
  "error_class": "TimeoutError | ToolError | ModelError | TenantViolation",
  "error_message": "human-readable",
  "partial_result": { /* whatever was completed before the failure */ },
  "retry_strategy": "retry | escalate | abandon"
}
```

## Auto-Optimization
- Tracks spawn success rate, adjusts batch size based on system load
- Retries failed spawns with exponential backoff (1s, 2s, 4s, abandon)
- Logs to `/home/node/.openclaw/hindsight/spawn.log`
- Every 10 spawns, recomputes optimal concurrency from p50/p95 latency

## Hard Gate
Any worker whose output contains `tenant_id != "{{TENANT_ID}}"` raises `TenantViolation` and is dropped (output discarded, not returned to caller). This prevents a hijacked worker from leaking data across tenants.
