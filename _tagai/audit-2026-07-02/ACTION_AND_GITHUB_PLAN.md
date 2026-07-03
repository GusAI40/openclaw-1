# Recommended Action And GitHub Update Plan

## Priority 1 - Protect Accounts And Unlock Validation

1. Rotate the exposed Vercel, Supabase, and GitHub tokens.
2. Fix pnpm configuration drift:
   - Move ignored `package.json` `pnpm` settings into `pnpm-workspace.yaml`.
   - Decide whether `@whiskeysockets/baileys` should be pinned, patched, replaced, or explicitly allowed without weakening supply-chain policy blindly.
3. Rerun `pnpm docs:list`.
4. After docs list works, run the scoped repo gate for documentation-only changes.

Business impact: protects the keys to the city and restores the ability to verify work.

## Priority 2 - Make The Vercel Upgrade Real

This repo is not the Vercel app. The real Vercel upgrade must happen inside the actual Vercel project repos.

For each Vercel app repo:

1. Confirm source repo and Vercel project link.
2. Add or update `vercel.ts` only if the project is actually deployed by Vercel.
3. Enable or verify Fluid Compute for API/AI-heavy workloads.
4. Move AI calls to Vercel AI Gateway where it improves observability and fallback.
5. Add Queues or Workflows for multi-step lead/report/email work.
6. Use Rolling Releases for production funnel changes.
7. Add project-specific runbooks for rollback, logs, env vars, and deploy promotion.

Business impact: faster sites, safer launches, better model cost control.

## Priority 3 - Productize The Rescue Pipeline

1. Convert rescue flow into a durable pipeline:
   - scan,
   - score,
   - report,
   - ledger,
   - send,
   - follow-up,
   - CRM/operator handoff.
2. Put tenant isolation, suppression lists, snooze lists, send ledgers, and domain controls in the schema.
3. Keep shared sender domains away from cold high-volume outreach.
4. Review Julian's four real-looking pending deliverables from the recovery docs.

Business impact: more qualified leads with less manual work and less sender-domain risk.

## Priority 4 - Split Provider Cleanup Into Focused PRs

1. Firecrawl PR - finish dirty provider work against official Firecrawl Node SDK docs.
2. Supabase PR - explicit grants, RLS, advisors, tenant claims.
3. Microsoft Graph PR - mailbox isolation and retry/backoff strategy.
4. Vercel AI Gateway PR - provider-contract docs and model-id validation.
5. Docs index PR - connect latest audit bundle from older `_tagai/audit-*` maps.

Business impact: fewer brittle integrations and cleaner handoffs.

## GitHub Update Plan

Commit this audit bundle:

- `_tagai/audit-2026-07-02/README.md`
- `_tagai/audit-2026-07-02/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-07-02/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-07-02/REVENUE_FLOW.md`
- `_tagai/audit-2026-07-02/RISK_REGISTER.md`
- `_tagai/audit-2026-07-02/ACTION_AND_GITHUB_PLAN.md`

Do not include unrelated dirty files in this commit:

- `CHANGELOG.md`
- existing dirty `_tagai/*.md` and env examples
- dirty Firecrawl source/docs
- deleted `_tagai/webhook-handler.mjs`
- untracked prospect files

Suggested commit message:

```text
docs: add July 2026 repo audit bundle
```

## Ready-To-Commit README Content

Suggested top-level audit link for `_tagai/README.md`:

```markdown
## Current Repo Audit

Latest TAG AI/OpenClaw audit bundle:

- `_tagai/audit-2026-07-02/README.md`
- `_tagai/audit-2026-07-02/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-07-02/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-07-02/REVENUE_FLOW.md`
- `_tagai/audit-2026-07-02/RISK_REGISTER.md`
- `_tagai/audit-2026-07-02/ACTION_AND_GITHUB_PLAN.md`

Plain-English summary: this repo is the OpenClaw gateway city, not a Vercel app. Vercel upgrades belong in the adjacent customer-facing app repos. The immediate blockers are exposed tokens, pnpm docs-list failure, and rescue pipeline hardening.
```

Suggested architecture-doc summary:

```markdown
## Architecture Summary

State: TAG AI operating system.
City: OpenClaw gateway plus TAG operating docs.
Streets: `src/`, `extensions/`, `ui/`, `apps/`, `packages/`, `scripts/`, `mcp-servers/`, `rescue-websites-sim/`, `_tagai/`.
Houses: gateway runtime, plugin system, control UI, mobile clients, tenant bootstrap, provider tools, rescue lead engine.
Rooms: configs, scripts, migrations, prompts, tests, manifests, environment-variable contracts, MCP server handlers.
Workers: gateway, agents, plugin workers, MCP servers, preflight scripts, rescue simulator, outreach tools.
Tools: Vercel, Supabase, GitHub, pnpm, Node.js, TypeScript, Vitest, Docker, Caddy, Firecrawl, Microsoft Graph, Resend, OpenAI, Google, LiveKit.
Revenue purpose: automate lead research, customer communication, tenant launch, and AI assistant delivery.
```

## Definition Of Done For The Next Pass

- Tokens rotated.
- `pnpm docs:list` succeeds.
- Latest audit bundle pushed to GitHub.
- Separate issue/PR opened for pnpm settings drift.
- Actual Vercel app repo selected for first real Fluid/AI Gateway/Workflow upgrade.
