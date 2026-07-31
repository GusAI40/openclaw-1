# TAG AI / OpenClaw Senior Repo Audit - 2026-07-03

Purpose: reconstruct the current repo state, explain it as a city, validate the live documentation for the providers and frameworks involved, identify revenue purpose, and define the next GitHub-safe action plan.

This bundle is a documentation audit only. It does not change product code, provider logic, deployment config, secrets, schema, or runtime behavior.

## Read In This Order

1. `REPO_VISUAL_MAP.md` - the state, city, street, house, room map.
2. `TECHNICAL_ARCHITECTURE.md` - the tech stack pipeline in plain English.
3. `PROVIDER_VALIDATION.md` - official documentation checked on 2026-07-03.
4. `REVENUE_FLOW.md` - how the repo is meant to create leads, revenue, time savings, and leverage.
5. `RISK_REGISTER.md` - what is broken, unsafe, duplicated, stale, or likely to fail.
6. `ACTION_AND_GITHUB_PLAN.md` - next steps, GitHub update plan, and ready-to-commit docs content.
7. `GITHUB_SYNC_REPORT.md` - current branch, worktree state, and safe commit scope.

## Confirmed Current State

- Repo path: `openclaw-4-25-26`.
- Git branch: `docs/ecosystem-map-2026-06-11`.
- Git remote for the fork: `origin` -> `GusAI40/openclaw-1`.
- Upstream remote: `upstream` -> `openclaw/openclaw`.
- Package manager: `pnpm@10.33.0` in `package.json`; local `pnpm --version` reports `11.7.0`.
- Runtime target: Node `>=22.14.0`; local Node reports `v22.14.0`.
- Main system: Node/TypeScript ESM monorepo with OpenClaw gateway, plugins, UI, apps, MCP servers, and TAG overlay docs.
- Current worktree is dirty before this July 3 audit. Firecrawl provider work, TAG infra docs, and untracked Julian/prospect files already exist and must not be mixed blindly into this audit commit.

## Answer To The Documentation Question

Yes, for this audit pass I consulted official current documentation before making recommendations or documentation edits. Context7 MCP was not exposed in this session, so I used official web documentation directly and recorded those sources in `PROVIDER_VALIDATION.md`.

Important limit: this repo has many provider plugins. I validated the current official docs for the provider families and high-risk surfaces detected in this repo, but I did not perform a line-by-line endpoint audit for every plugin. That deeper pass must happen before changing any specific provider plugin code.

## Plain-English Headline

This repo is not just a website. It is more like a city operations center:

- OpenClaw is city hall.
- `src/` is the main road system.
- `extensions/` is the equipment district.
- `ui/` and `apps/` are the control rooms people touch.
- `_tagai/` is the TAG business overlay.
- `rescue-websites-sim/` and Julian recovery docs are revenue-factory labs.
- Agents, cron jobs, MCP servers, and plugin tools are the workers inside the buildings.

The biggest business risk is not lack of tools. The city has many tools. The biggest risk is that secrets, provider accounts, tenant identity, sender domains, and lead-flow records are not yet one clean, guarded road from lead to revenue.

## Critical Calls

1. Rotate the Vercel, Supabase, and GitHub tokens that were pasted into chat. Treat them as exposed.
2. Do not commit all dirty files together. The worktree contains unrelated Firecrawl and TAG infra changes.
3. Finish the Firecrawl provider work in its own PR after validating against Firecrawl `/v2/agent` docs.
4. Keep this repo as the OpenClaw gateway city. Do Vercel application upgrades in the actual Vercel app repos.
5. Turn rescue websites into a durable pipeline: scan -> score -> report -> send ledger -> outreach -> follow-up -> CRM/operator handoff.
