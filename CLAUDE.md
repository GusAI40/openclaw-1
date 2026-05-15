# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

This repo is a **fork**. Two sources of truth, both required:

- `AGENTS.md` — upstream OpenClaw contributor rules (commands, gates, code style, CI). Scoped `AGENTS.md` files also exist in `extensions/`, `src/{plugin-sdk,channels,plugins,gateway,agents}/`, `docs/`, `ui/`, `scripts/`, and `test/helpers*/`. Read the closest one before touching that subtree.
- `_tagai/CLAUDE.md` — TAG-specific overlay (Jarvis AI). Read this **before** assuming deployment topology, branch convention, or anything ops-related. The Hetzner deploy is plain `docker compose` + Caddy on the host — no Coolify, no Traefik — and past sessions have regressed to the wrong mental model.

When `AGENTS.md` and `_tagai/CLAUDE.md` overlap, scope wins: upstream rules apply to upstream files; TAG rules apply to `_tagai/` and to anything that touches the deployed Hetzner box.

## Repository layout

This is a **pnpm workspace** (`pnpm-workspace.yaml`). Big-picture pieces:

- `src/` — Core OpenClaw runtime (TS ESM, strict). Entry: `src/entry.ts`. Notable subtrees:
  - `src/gateway/` — control-plane gateway; protocol contracts in `src/gateway/protocol/`
  - `src/plugin-sdk/` — public SDK surface plugins import from
  - `src/plugins/` — plugin loader (not the plugins themselves)
  - `src/channels/` — channel implementations (WhatsApp, Telegram, Slack, etc.)
  - `src/agents/` — agent runtime and harness
  - `src/cli/`, `src/commands/`, `src/daemon/` — CLI + daemon
- `extensions/` — ~120 plugins (one dir per channel/provider/tool), independently typed and tested. Extension prod code may NOT import from core `src/**` except via `openclaw/plugin-sdk/*` barrels. The boundary is enforced by `lint:extensions:*` and `lint:plugins:*` gates.
- `packages/` — `plugin-sdk`, `plugin-package-contract`, `memory-host-sdk`
- `ui/`, `apps/` — Control UI and companion apps (macOS/iOS/Android)
- `docs/`, `Swabble/` — Docs site and example app
- `_tagai/` — **TAG overlay**: compose overlay, deploy runbooks, brand layer. Lives outside upstream's reach so rebases stay clean.
- `rescue-websites-sim/` — Standalone npm project, NOT in the pnpm workspace. Pure-mock simulator for TAG's outbound rescue-websites pipeline; has its own `README.md`, `package.json`, migrations, and runs.
- `mcp-servers/` — MCP server scratch space.

## Branch and remote conventions (fork)

- TAG work lives on `tagai-main`. `main` tracks upstream (`openclaw/openclaw`).
- Push to `origin` (TAG fork) only. **Never** push to `upstream`.
- Sync upstream with `git fetch upstream && git merge upstream/main`. Prefer adding files under `_tagai/` over modifying upstream files.

## Common commands

Runtime: **Node 22.14+ (24 recommended)**. Package manager: **pnpm 10.33.0** (pinned via `packageManager`).

```bash
pnpm install              # install workspace deps
pnpm dev                  # run local CLI from src
pnpm openclaw <subcmd>    # same, with CLI args
pnpm build                # full build (scripts/build-all.mjs)

pnpm check:changed        # smart gate — typecheck + tests for changed lanes (preferred before push)
pnpm check                # full prod sweep
pnpm test                 # all tests (Vitest)
pnpm test:changed         # only tests touching changed lanes
pnpm test <path>          # targeted; vitest args follow path. NEVER call raw `vitest`.
pnpm test:extensions      # all extension test suites
pnpm test extensions/<id> # single extension's tests

pnpm tsgo                 # typecheck — use `tsgo` lanes only (do NOT add `tsc --noEmit` scripts)
pnpm check:test-types     # = pnpm tsgo:test

pnpm format / pnpm format:check    # oxfmt
pnpm lint  / pnpm lint:fix         # oxlint (sharded)
```

The `rescue-websites-sim/` simulator uses plain npm (`npm run sim:smoke`, `npm run sim:full`) — it is intentionally not part of the pnpm workspace.

Commits should go through `scripts/committer "<msg>" <file...>` per `AGENTS.md` so staged formatting runs consistently.

## Key footguns (from prior sessions)

- **Schema version clobber on container restart**: `openclaw.json.meta.lastTouchedVersion` must equal the running image's `/app/package.json` version on boot. Bump it before any image upgrade. The current package version is `2026.4.25`.
- **LLM auth lives in `agents/main/agent/auth-profiles.json`** (per-tenant, mode 600), not in env vars. Missing file → silent provider failover loops.
- **Caddy on the Hetzner host** (not in Docker) terminates TLS for `*.ubntag.com` and proxies to loopback ports. Do not add Traefik labels or external networks to `_tagai/docker-compose.tagai.yml`.
- **PowerShell `scp` can't read `.ssh/config`** on this Windows machine — use Git Bash / the Bash tool for VPS file transfers.
- **Audit scripts that `sed s/=.*/=<REDACTED>/`** make empty `.env` values look populated. For real "is this key present" checks: `grep -E '^KEY=[^[:space:]]+'`.
