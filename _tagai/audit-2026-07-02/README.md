# TAG AI / OpenClaw Audit Bundle - 2026-07-02

Purpose: map the repo as a city, explain the tech stack pipeline in plain English, validate the current provider docs, identify revenue paths, and define the next GitHub update plan.

This audit is scoped to the local repo at `openclaw-4-25-26`. It does not claim that every adjacent Vercel app repo has been upgraded. This repo is the OpenClaw gateway/plugin monorepo plus TAG operating docs and rescue pipeline assets.

## Read In This Order

1. `REPO_VISUAL_MAP.md` - the city/state/street/house/room map.
2. `PROVIDER_VALIDATION.md` - official docs checked and repo areas that depend on each provider.
3. `REVENUE_FLOW.md` - how the system is meant to create leads, revenue, time savings, and operating leverage.
4. `RISK_REGISTER.md` - what is broken, unsafe, outdated, duplicated, or likely to fail.
5. `ACTION_AND_GITHUB_PLAN.md` - prioritized next steps, GitHub update plan, and ready-to-commit README content.

## Confirmed Facts

- The repo is OpenClaw, a Node/TypeScript ESM monorepo for a multi-channel AI gateway and plugin system.
- The repo has `src/`, `extensions/`, `ui/`, `apps/`, `packages/`, `scripts/`, `mcp-servers/`, `rescue-websites-sim/`, and `_tagai/`.
- The repo has no root `vercel.json`, no `vercel.ts`, and no `next.config.*`.
- `Vercel CLI 54.18.1` is installed locally.
- `pnpm docs:list` initially failed before docs indexing because the workspace install hit `@whiskeysockets/baileys@7.0.0-rc.9` pulling a git `libsignal` subdependency while pnpm `blockExoticSubdeps` was enabled.
- Follow-up package-manager work resolved the docs blocker by moving pnpm settings into `pnpm-workspace.yaml`, keeping `blockExoticSubdeps` enabled, and upgrading Baileys to `7.0.0-rc13`, which uses npm `libsignal@6.0.0`.
- The worktree already had unrelated dirty files before this audit bundle was added. This bundle does not modify those files.
- Julian's rescue website work was previously recovered from a fragile container layer, backed up, and pushed to GitHub. The remaining uncommitted files were deliberate scratch or pending deliverables.

## Plain-English Headline

Think of this repo as the city operations center. It is not one storefront. It is the system that runs assistants, tools, channels, tenant gateways, and revenue machines. Vercel is a neighborhood where many customer-facing storefronts should live, but this OpenClaw repo itself is not currently a Vercel app.

The fastest safe business move is:

1. Keep the package-manager/docs gate green.
2. Keep OpenClaw as the gateway city.
3. Use Vercel for actual web storefront repos.
4. Use Supabase as the durable record book, with explicit grants and RLS.
5. Convert rescue website work into a reliable scan-to-report-to-follow-up pipeline.
6. Rotate exposed tokens before treating any connected account as safe.
