# Recommended Action And GitHub Update Plan

Audit date: 2026-07-03

## Priority 1 - Protect The Keys To The City

1. Rotate the pasted Vercel PAT.
2. Rotate the pasted Supabase PAT.
3. Rotate the pasted GitHub PAT.
4. Audit any account activity that happened after those tokens were pasted.
5. Do not paste replacement tokens into chat or commit them to files.

Business impact: protects the accounts that can deploy, read data, or push code.

## Priority 2 - Commit Only The Audit Bundle

Stage only:

- `_tagai/audit-2026-07-03/README.md`
- `_tagai/audit-2026-07-03/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-07-03/TECHNICAL_ARCHITECTURE.md`
- `_tagai/audit-2026-07-03/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-07-03/REVENUE_FLOW.md`
- `_tagai/audit-2026-07-03/RISK_REGISTER.md`
- `_tagai/audit-2026-07-03/ACTION_AND_GITHUB_PLAN.md`
- `_tagai/audit-2026-07-03/GITHUB_SYNC_REPORT.md`
- `_tagai/README.md`

Do not include unless separately approved:

- Firecrawl source changes.
- Deleted `_tagai/webhook-handler.mjs`.
- Dirty TAG infra docs.
- Untracked Julian/prospect/archive files.
- `CHANGELOG.md`.

Suggested commit message:

```text
docs: add July 2026 senior repo audit
```

## Priority 3 - Split Provider Cleanup Into Focused PRs

1. Firecrawl PR:
   - Validate `/v2/agent` start/status/cancel against official Firecrawl docs.
   - Read the changed code and tests line by line.
   - Run `pnpm test extensions/firecrawl`.
   - Run `pnpm check:changed`.
2. Supabase PR:
   - Build migration templates with explicit grants, RLS, policies, and advisors.
3. Microsoft Graph PR:
   - Add mailbox isolation docs and tests.
4. DeepSeek PR:
   - Search for deprecated model IDs before 2026-07-24.
5. Nostr PR:
   - Review NIP-04 usage and migration path.

## Priority 4 - Productize The Rescue Pipeline

Create a real lead-to-revenue road:

1. Scan website.
2. Score website problems.
3. Build report/demo.
4. Write Supabase lead record.
5. Write send ledger record.
6. Send email through a dedicated sender domain.
7. Suppress duplicates and opt-outs.
8. Follow up.
9. Hand off to CRM/operator.

Business impact: more leads, fewer manual retries, lower sender-domain risk.

## Priority 5 - Make The Vercel Upgrade Real

This repo is the gateway city. The actual Vercel upgrade belongs in the real Vercel app repos.

For each app repo:

1. Confirm project link in Vercel.
2. Confirm framework and build command.
3. Add `vercel.ts` only if the repo is actually deployed on Vercel.
4. Enable/verify Fluid Compute for AI/API-heavy routes.
5. Use AI Gateway where model routing and observability help.
6. Use Queues or Workflows for long lead/report/email jobs.
7. Add deploy, rollback, env var, logs, and incident runbooks.

## Ready-To-Commit `_tagai/README.md` Content

```markdown
## Current Senior Repo Audit

Latest city-map audit bundle:

- `_tagai/audit-2026-07-03/README.md`
- `_tagai/audit-2026-07-03/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-07-03/TECHNICAL_ARCHITECTURE.md`
- `_tagai/audit-2026-07-03/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-07-03/REVENUE_FLOW.md`
- `_tagai/audit-2026-07-03/RISK_REGISTER.md`
- `_tagai/audit-2026-07-03/ACTION_AND_GITHUB_PLAN.md`
- `_tagai/audit-2026-07-03/GITHUB_SYNC_REPORT.md`

Plain-English summary: this repo is the OpenClaw gateway city plus TAG operating overlay. It is not itself a Vercel website. The immediate blockers are exposed tokens, mixed dirty worktree, Firecrawl provider validation, webhook deletion verification, and rescue-pipeline hardening.
```

## Definition Of Done

- Tokens rotated.
- July 3 audit bundle committed and pushed.
- Firecrawl work split into its own branch/PR.
- Webhook deletion verified before commit.
- First real Vercel app repo selected for actual Vercel platform upgrade.
- Rescue pipeline schema and sender-domain safety plan approved before live sending.
