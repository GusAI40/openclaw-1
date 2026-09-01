# Corp Roster Templates

These four CSVs define the canonical 100-agent org structure that every tenant inherits.

## Files

| File | Rows | Purpose |
|---|---|---|
| `corp-board.csv` | 7 | Board of Directors (Chairman + 6 Oracles) |
| `corp-c-suite.csv` | 8 | C-Suite (CEO, COO=Jarvis, CTO=Hermes, + 5 Oracles) |
| `corp-agent-roster.csv` | 100 | The full 100-agent workforce in 10 departments |
| `corp-b2b-sales.csv` | varies | Optional B2B sales sub-org under CMO Oracle |

## ID Prefix Convention

During `bootstrap-tenant.sh`, every ID in the first column is rewritten from `CORP-001` (or `BOD-001`, `CEO-001`, `B2B-001`) to `<TENANT_ID>-CORP-001` (resp `<TENANT_ID>-BOD-001`, etc).

This guarantees no cross-tenant ID collisions even if Hermes' `kanban.db` is ever consolidated across tenants for analytics.

## Schema

### corp-agent-roster.csv
```
ID,Role,Department,Lead,Type,Skill
CORP-001,COO,Jarvis,Executive,Permanent,Orchestration
CORP-003,Strategy Analyst,Executive,exec-lead,Subagent,research
...
```

- **ID**: globally unique (will be tenant-prefixed)
- **Role**: human-readable agent name
- **Department**: one of `Executive | Engineering | AI & Research | Sales & Marketing | Client Success | Operations | Creative & Media | Data & Analytics | Legal & Compliance | Hollywood Studio`
- **Lead**: the dept-lead kanban profile name (`exec-lead`, `eng-lead`, etc.)
- **Type**: `Permanent` (CEO/COO/CTO/dept leads) or `Subagent` (spawned on demand)
- **Skill**: the tag that Hermes uses to match a task to a worker — one of `research`, `software-dev`, `devops`, `testing`, `mlops`, `content`, `data-science`, `data-analysis`, `risk-mgmt`, `documentation`, `compliance`, `autonomous-ai-agents`, etc.

## Customization

Tenants can override individual rows after provisioning by editing `/home/tagai/tenants/<TENANT_ID>/.openclaw/corp/*.csv` directly. Changes take effect on the next Hermes restart.

To regenerate from template (loses local edits): re-run `bootstrap-tenant.sh <TENANT_ID> <DOMAIN> <OWNER_EMAIL>` — the script is idempotent and will overwrite the CSVs.
