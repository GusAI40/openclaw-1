# CLAUDE.md — TAG AI overlay for OpenClaw fork

This is the TAG AI fork of OpenClaw (`GusAI40/openclaw-1`). Upstream is `openclaw/openclaw`.

## Working in this repo

- DO NOT modify upstream files (`docker-compose.yml`, `Dockerfile`, `package.json`, `apps/`, `extensions/`, `Swabble/`, etc.) unless making a contribution intended for upstream.
- All TAG-AI customization lives in `_tagai/`.
- Deployment overlay: `_tagai/docker-compose.tagai.yml` is composed on top of upstream `docker-compose.yml`.
- Env vars: `_tagai/.env.tagai.example` lists everything; real values live in `/home/tagai/.tagai-env` on Hetzner (NEVER commit real values).

## When asked to deploy / redeploy

- See `_tagai/DEPLOY_HETZNER.md`. Coolify project is `openclaw`. Domain `openclaw.ubntag.com`.

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
- Do NOT commit secrets — use `/home/tagai/.tagai-env` on the server
- Do NOT modify upstream files unless contributing back
- Do NOT add business logic to OpenClaw — invoke a skill or JARVIS agent instead

## When the founder messages

- Em dashes are forbidden in user-facing output
- Refer to yourself as "Jarvis" in conversational responses
- Never send any email, post, or external action without approval — same hard rule as the JARVIS pipeline
