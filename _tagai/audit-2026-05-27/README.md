# Senior-Engineer Repo Audit — 2026-05-27

Triggered by `/audit-repo` from `tagai-main` branch.

**Scope locked:** TAG-owned layers only (`_tagai/`, Hetzner deploy stack, `mcp-servers/`, `rescue-websites-sim/`, external providers actually wired up). Upstream OpenClaw (`src/`, `extensions/`, `packages/`, `ui/`, `apps/`) is out of scope — upstream's job.

## Files in this folder

1. **`REPO_VISUAL_MAP.md`** — State / city / street Mermaid map. Read this first.
2. **`TECHNICAL_ARCHITECTURE.md`** — Per-city writeups (purpose, money, streets, houses, workers, risks).
3. **`PROVIDER_VALIDATION.md`** — Live docs check + live runtime evidence per external provider. Honest about which were not validated.
4. **`REVENUE_FLOW.md`** — How this codebase makes/protects money. Names the leaks.
5. **`RISK_REGISTER.md`** — 16 open risks, severity-graded (Critical → Low).
6. **`GITHUB_SYNC_REPORT.md`** — git state at audit time, push recommendations.

## The one finding that matters most

**R-1 (Critical):** Gus's main `openclaw.json` has DOTTED Claude model IDs (`claude-haiku-4.5`, `claude-sonnet-4.6`). Anthropic API rejects these (verified against live docs 2026-05-27). Julian's tenant has the correct dashed forms. If DeepSeek throttles, Gus's brain dies silently. **5-minute `sed` fix on the box.**

See `RISK_REGISTER.md` for the exact command and the rest.

## What was not done in this audit

- Did NOT push. `--push` flag was not passed.
- Did NOT run `pnpm build` / `pnpm test`. Docs-only changes.
- Did NOT validate Google AI / OpenAI / Cloudflare Pages / Microsoft Graph / Supabase / Resend docs — deferred to next audit. Live runtime evidence cited where I had it.
- Did NOT audit upstream OpenClaw code (out of scope per the scope decision at the top of this run).
