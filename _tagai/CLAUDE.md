# CLAUDE.md — TAG AI overlay for OpenClaw fork

This is the TAG AI fork of OpenClaw (`GusAI40/openclaw-1`). Upstream is `openclaw/openclaw`.

## Server reality (READ THIS FIRST)

The Hetzner deploy is **plain `docker compose`** at `/home/tagai/openclaw/`,
fronted by **Caddy v2.11.2 on the host** (NOT in Docker). TLS is automatic
via Caddy's built-in Let's Encrypt. There is **NO Coolify, NO Traefik, NO
external reverse-proxy network** on this server. The original `_tagai/`
overlay was written assuming Coolify + Traefik and was wrong — it has been
rewritten.

Before assuming any infrastructure topology, READ:
- `_tagai/HETZNER_PREFLIGHT.md` — current server state and what's installed
- `_tagai/CADDY_AUDIT.md` — actual reverse-proxy config and routing
- `_tagai/CLI_HEALTH_INVESTIGATION.md` — the CLI orphan-namespace bug + fix
- `_tagai/SERVER_REPO_STATE.md` — branch, SHA, drift vs. local

Do not regress to the old Coolify mental model. If something says "let's
redeploy via Coolify" or "add a Traefik label," it's working from stale
assumptions.

## Working in this repo

- DO NOT modify upstream files (`docker-compose.yml`, `Dockerfile`, `package.json`, `apps/`, `extensions/`, `Swabble/`, etc.) unless making a contribution intended for upstream.
- All TAG-AI customization lives in `_tagai/`.
- Deployment overlay: `_tagai/docker-compose.tagai.yml` is composed on top of upstream `docker-compose.yml`.
- Env vars: `_tagai/.env.tagai.example` lists everything; real values live in `/home/tagai/openclaw/.env` and `/home/tagai/.tagai-env` on Hetzner (NEVER commit real values).

## When asked to deploy / redeploy

- See `_tagai/DEPLOY_HETZNER.md`. The standard update flow is:
  ```bash
  cd /home/tagai/openclaw
  git fetch origin && git checkout tagai-main && git pull --ff-only origin tagai-main
  docker compose -f docker-compose.yml -f _tagai/docker-compose.tagai.yml up -d --build
  ```
- Verify with `curl https://openclaw.ubntag.com/healthz` (should return `{"ok":true,"status":"live"}`).
- Caddy on the host already routes `openclaw.ubntag.com` → `localhost:18789`. Do NOT touch the Caddyfile unless adding a new route.
- Domain: `openclaw.ubntag.com`. Server: `tagai-cloud` / `87.99.148.242`.

## When asked about onboarding

- See `_tagai/ONBOARD_PLAYBOOK.md`. The `openclaw onboard` command is interactive — run on Hetzner as `tagai` user.

## When asked about channels

- See `_tagai/CHANNEL_STRATEGY.md`. Tier 1: WhatsApp, Telegram. Tier 2: Slack. Tier 3: iMessage, SMS.

## When asked about capabilities

- See `_tagai/CAPABILITIES.md` for the inventory of skills and JARVIS agents OpenClaw can invoke.

## When making changes

- TAG changes on branch `tagai-main`
- Stay rebase-friendly with upstream: prefer adding files in `_tagai/` over modifying upstream files
- Sync upstream: `git fetch upstream && git merge upstream/main`

## Architecture context

- See `_tagai/INTEGRATION.md` for how OpenClaw fits in the TAG AI stack
- Server: Hetzner CPX21 (87.99.148.242), see `C:\Users\gsanc\TAG-Projects-2026\_shared\docs\HETZNER_INFRASTRUCTURE.yaml`
- OpenClaw is a thin gateway. Business logic lives in JARVIS pipeline + Supabase + skills, not in this repo.

## Forbidden

- Do NOT push to `upstream` (only to `origin`)
- Do NOT commit secrets — use `/home/tagai/openclaw/.env` and `/home/tagai/.tagai-env` on the server
- Do NOT modify upstream files unless contributing back
- Do NOT add business logic to OpenClaw — invoke a skill or JARVIS agent instead
- Do NOT add Coolify, Traefik, or any new reverse-proxy infrastructure to this stack — Caddy on the host already terminates TLS and proxies all five `*.ubntag.com` domains
- Do NOT add Traefik labels (`traefik.*`) or external networks (e.g. `coolify`) to `_tagai/docker-compose.tagai.yml` — they are dead weight on this server

## When the founder messages

- Em dashes are forbidden in user-facing output
- Refer to yourself as "Jarvis" in conversational responses
- Never send any email, post, or external action without approval — same hard rule as the JARVIS pipeline
