# Project Blueprint: openclaw-4-25-26

> Auto-generated architecture documentation — 2026-05-23

## Overview

Project documentation pending.

**GitHub:** https://github.com/GusAI40/openclaw-1.git

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | JavaScript/TypeScript, Node.js, Docker, Docker Compose, dotenv |
| File Count | Python: 15, JS/TS: 21108, Markdown: 1496 |

### Dependencies
```
DEPS:@agentclientprotocol/sdk,@clack/prompts,@lydell/node-pty,@mariozechner/pi-agent-core,@mariozechner/pi-ai,@mariozechner/pi-coding-agent,@mariozechner/pi-tui,@modelcontextprotocol/sdk,@vincentkoc/qrcode-tui,ajv,chalk,chokidar,commander,croner,dotenv
DEVDEPS:@copilotkit/aimock,@grammyjs/types,@lit-labs/signals,@lit/context,@mdx-js/mdx,@types/express,@types/markdown-it,@types/node,@types/ws,@typescript/native-preview
```

## Architecture — Atomic Breakdown

### Atoms (Individual Source Files)
| File | Role |
|------|------|
| .audit-2026-05-11/scripts/seed-rescue-env.py |
| .test_audit_openclaw/01-docs-openclaw-ai/filter_and_expand.py |
| .test_audit_openclaw/02-github-docs/mirror_docs.py |
| .test_audit_openclaw/extract_main_content.py |
| fix2.py |
| scripts/check-composite-action-input-interpolation.py |
| skills/model-usage/scripts/model_usage.py |
| skills/model-usage/scripts/test_model_usage.py |
| skills/skill-creator/scripts/init_skill.py |
| skills/skill-creator/scripts/package_skill.py |
| skills/skill-creator/scripts/quick_validate.py |
| skills/skill-creator/scripts/test_package_skill.py |
| skills/skill-creator/scripts/test_quick_validate.py |
| _tagai/maya-test-harness.py |
| _tagai/patch-maya-tools.py || .cinematic-pilot-edits/template-engine.ts |
| .pi/extensions/diff.ts |
| .pi/extensions/files.ts |
| .pi/extensions/prompt-url-widget.ts |
| .pi/extensions/redraws.ts |
| .pi/extensions/ui/paged-select.ts |
| .test_audit_openclaw/02-github-docs/source/nav-tabs-underline.js |
| .test_audit_openclaw/node_modules/playwright/cli.js |
| .test_audit_openclaw/node_modules/playwright/index.d.ts |
| .test_audit_openclaw/node_modules/playwright/index.js |
| .test_audit_openclaw/node_modules/playwright/jsx-runtime.js |
| .test_audit_openclaw/node_modules/playwright/lib/agents/agentParser.js |
| .test_audit_openclaw/node_modules/playwright/lib/agents/generateAgents.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/config.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/configLoader.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/esmLoaderHost.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/expectBundle.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/expectBundleImpl.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/fixtures.js |
| .test_audit_openclaw/node_modules/playwright/lib/common/globals.js |

### Molecules (Functional Groups)
| Directory | Contents |
|-----------|----------|
| .audit-2026-05-11/scripts | 1 source files |
| .cinematic-pilot-edits | 1 source files |
| .pi/extensions | 4 source files |
| .test_audit_openclaw | 1 source files |
| .test_audit_openclaw/01-docs-openclaw-ai | 1 source files |
| .test_audit_openclaw/02-github-docs | 1 source files |
| docs | 1 source files |
| extensions | 2 source files |
| extensions/acpx | 5 source files |
| extensions/active-memory | 3 source files |

### Organism (System)
The complete `openclaw-4-25-26` system integrating all molecules above.

## File Inventory

```
./.audit-2026-05-11/.gitignore
./.audit-2026-05-11/FLEET-MANIFEST.md
./.audit-2026-05-11/MASTER-AUDIT.md
./.audit-2026-05-11/REDACTIONS.md
./.audit-2026-05-11/SESSION-COMPLETE.md
./.audit-2026-05-11/bootstrap-tenant/HERMES-SWARM-EXTRACTION.md
./.audit-2026-05-11/bootstrap-tenant/README.md
./.audit-2026-05-11/bootstrap-tenant/bootstrap-tenant.sh
./.audit-2026-05-11/bootstrap-tenant/list-tenants.sh
./.audit-2026-05-11/bootstrap-tenant/teardown-tenant.sh
./.audit-2026-05-11/drift/DRIFT.json
./.audit-2026-05-11/drift/SCHEMA-RISK.json
./.audit-2026-05-11/hermes-swarm/HERMES.json
./.audit-2026-05-11/integration-plans/REPO-INTEGRATION-PLAN.md
./.audit-2026-05-11/openclaw-image/Dockerfile.grammy
./.audit-2026-05-11/openclaw-image/README.md
./.audit-2026-05-11/runbook/RUNBOOK.md
./.audit-2026-05-11/scripts/README.md
./.audit-2026-05-11/scripts/SYNC-TO-GITHUB-README.md
./.audit-2026-05-11/scripts/age-public-key.txt
./.audit-2026-05-11/scripts/backup-agent-memory.sh
./.audit-2026-05-11/scripts/backup.sh.new
./.audit-2026-05-11/scripts/seed-rescue-env.py
./.audit-2026-05-11/scripts/step-8.6-patch.txt
./.audit-2026-05-11/scripts/sync-to-github.sh
./.audit-2026-05-11/services/DATA.json
./.audit-2026-05-11/services/ROUTES.json
./.audit-2026-05-11/services/SECRETS.json
./.audit-2026-05-11/services/SERVICES.json
./.audit-2026-05-11/services/SHARED-CLASSIFICATION-RAW.tsv
./.audit-2026-05-11/services/SHARED-CLASSIFICATION.md
./.audit-2026-05-11/vps-snapshot/AI_CORPORATION_BLUEPRINT.md
./.audit-2026-05-11/vps-snapshot/ARCHITECTURE_AUDIT_2026-05-07.md
./.audit-2026-05-11/vps-snapshot/Caddyfile.vps
./.audit-2026-05-11/vps-snapshot/MULTI_TENANT_6000_CALL_SIMULATION.md
./.audit-2026-05-11/vps-snapshot/SYSTEM_ARCHITECTURE.LOCAL-ONLY.md
./.audit-2026-05-11/vps-snapshot/UNIFIED_ARCHITECTURE.md
./.audit-2026-05-11/vps-snapshot/corp-agent-roster.csv
./.audit-2026-05-11/vps-snapshot/corp-b2b-sales.csv
./.audit-2026-05-11/vps-snapshot/corp-board.csv
./.audit-2026-05-11/vps-snapshot/corp-c-suite.csv
./.audit-2026-05-11/vps-snapshot/jarvis-vapi.service
./.audit-2026-05-11/vps-snapshot/openclaw-compose.override.yml
./.audit-2026-05-11/vps-snapshot/openclaw-compose.yml
./.audit-2026-05-11/vps-snapshot/openclaw.json.redacted
./.cinematic-pilot-edits/apex-roofing.html
./.cinematic-pilot-edits/template-engine.ts
./.claude/hooks/openclaw-prompt-breadcrumb.cjs
./.claude/scheduled_tasks.lock
./.claude/settings.json
```

## Entry Points
\n- `src/index.ts`

## Directory Structure

```
.
./.agents
./.agents/skills
./.audit-2026-05-11
./.audit-2026-05-11/bootstrap-tenant
./.audit-2026-05-11/drift
./.audit-2026-05-11/hermes-swarm
./.audit-2026-05-11/integration-plans
./.audit-2026-05-11/openclaw-image
./.audit-2026-05-11/runbook
./.audit-2026-05-11/scripts
./.audit-2026-05-11/services
./.audit-2026-05-11/vps-snapshot
./.cinematic-pilot-edits
./.claude
./.claude/hooks
./.git
./.github
./.github/ISSUE_TEMPLATE
./.github/actions
./.github/codeql
./.github/codex
./.github/instructions
./.github/workflows
./.pi
./.pi/extensions
./.pi/git
./.pi/prompts
./.test_audit_openclaw
./.test_audit_openclaw/01-docs-openclaw-ai
```

## Environment Variables

- `OPENCLAW_GATEWAY_TOKEN`

## Data Flow

1. **Input** — User triggers via CLI, API, or scheduled task
2. **Processing** — Core logic in source files transforms data
3. **Output** — Results delivered via files, API responses, or external services

---

*Generated by TAG AI Blueprint Agent — 2026-05-23*
