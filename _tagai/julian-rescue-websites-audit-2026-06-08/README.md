# Audit — Julian rescue-websites — 2026-06-08

Senior-engineer audit of Julian's `rescue-websites` pipeline (his own app repo, `JaBeanJr/rescue-websites`), read first-hand from the VPS backup copy. Not the OpenClaw gateway.

## Read in this order
1. **`REPO_VISUAL_MAP.md`** — plain-English machine map + diagrams. Start here.
2. **`TECHNICAL_ARCHITECTURE.md`** — the 4-phase pipeline, scoring, data model, config contract.
3. **`PROVIDER_VALIDATION.md`** — the 9 providers vs live docs (Firecrawl v1→v2 + Places legacy are the real drift).
4. **`REVENUE_FLOW.md`** — how it makes money and where it leaks (shared sender domain = top leak).
5. **`RISK_REGISTER.md`** — severity-graded issues + the top-3 next actions.

## One-line headline
A self-running outbound engine that finds local businesses, grades their sites with an F-score, builds 3 live demo sites, and emails the owner — solid and revenue-shaped; the real watch-items are the shared `ubntag.com` sending domain, an exposed GitHub token, and Firecrawl/Places provider drift.

## GitHub / state (read-only check)
- Repo: `JaBeanJr/rescue-websites`, branch `fix/template-conflict-markers-only`.
- After today's recovery work, head = `77cbb1f` (4 Maze deliverables + the recovery doc committed and pushed).
- Validation this session: **zero unpushed commits**; only deliberate scratch files remain uncommitted.
- Work now in 3 safe places: GitHub, host backup, in-container.

## Scope honesty
- Read first-hand: `package.json`, `src/lib/env.ts`, `src/pipeline.ts`, `src/audit/audit.ts`, `src/lib/verticals.ts`, source tree.
- Provider docs validated via context7 for Firecrawl + Google Places (the drift-risk ones); other providers checked at installed-version level only.
- `README` in Julian's repo was **not** overwritten; his existing `BLUEPRINT.md` / `CLAUDE.md` are the project's own docs.

## Status
These audit docs are currently in this local folder only. Pending your go to also push them into Julian's repo `docs/` and copy to the VPS (same as the prior audit set).
