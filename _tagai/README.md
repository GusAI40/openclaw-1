# _tagai/ — Jarvis AI Overlay Layer

> Jarvis AI (the OpenClaw fork) — TAG's deployed product. The codebase keeps the upstream OpenClaw identity so we can rebase against `openclaw/openclaw` cleanly. Only the user-facing brand layer in this folder is rebranded.

## Purpose

This folder contains all Jarvis-AI-specific customization for the fork (`GusAI40/openclaw-1`). Everything that is **not** part of the upstream OpenClaw project lives here: deployment configs for Hetzner, channel routing strategy, capability inventory, onboarding playbooks, and Claude Code instructions for this repo.

## Why Separated

The repo root tracks upstream OpenClaw (`openclaw/openclaw`). Keeping our customization isolated in `_tagai/` lets us:

- Rebase cleanly against upstream without merge conflicts
- See exactly what TAG added vs what the upstream project ships
- Pull upstream improvements with `git fetch upstream && git merge upstream/main`
- Avoid polluting files (Dockerfile, package.json, apps/, etc.) that the upstream maintainers iterate on

The repo root `CLAUDE.md` is upstream's. Our Claude instructions live at `_tagai/CLAUDE.md`.

## Files in This Folder

### Start here

| File | Purpose |
|------|---------|
| **`BLUEPRINT.md`** | **The umbrella manual.** Why this fork exists, full architecture, the current fleet, end-to-end request flow, daily-ops cheat sheet with 11 footguns from real incidents, zero-to-running replication recipe, use-case adaptation patterns, real cost numbers. Read this first. |
| `README.md` | This file. Overlay layer overview + file inventory. |
| `CLAUDE.md` | Instructions for future Claude Code sessions opening this repo. |

### Architecture & deployment

| File | Purpose |
|------|---------|
| `DEPLOY_HETZNER.md` | Step-by-step deployment to Hetzner. Domain, ports, DNS. |
| `HETZNER_PREFLIGHT.md` | What's installed on the box and the current server state. |
| `CADDY_AUDIT.md` | The actual Caddy reverse-proxy config (on host, not in Docker). |
| `SERVER_REPO_STATE.md` | Branch / SHA on Hetzner vs. local drift. |
| `SERVER_PREP_STATUS.md` | One-time server-prep checklist + current status. |
| `DNS_STATUS.md` | `*.ubntag.com` DNS record state (Vercel-managed). |
| `docker-compose.tagai.yml` | Compose overlay layered on top of upstream `docker-compose.yml`. |
| `.env.tagai.example` | Reference list of all TAG-specific env vars. Real values live on the server. |

### Onboarding & day-to-day operations

| File | Purpose |
|------|---------|
| `ONBOARD_PLAYBOOK.md` | High-level operator runbook for the `openclaw onboard` command. |
| `ONBOARD_RUNBOOK.md` | Detailed step-by-step onboarding recipe. |
| `HEALTH.md` | Service health endpoints, status checks, recovery runbook. |
| `RESOURCE_CLEANUP.md` | Disk + container + image cleanup procedure. |
| `monitoring/HEALTH_YYYY-MM-DD.md` | Weekly health probe snapshots. |
| `monitoring/UPSTREAM_YYYY-MM-DD.md` | Weekly upstream-drift checks. |
| `monitoring/RESOURCE_REMINDER_YYYY-MM.md` | Monthly disk/RAM/cost reminders. |

### Strategy & inventory

| File | Purpose |
|------|---------|
| `INTEGRATION.md` | How Jarvis AI fits into the broader TAG AI stack (JARVIS pipeline, Supabase, Hetzner). |
| `BRAND.md` | Jarvis AI user-facing brand layer (color, tone, naming). |
| `CAPABILITIES.md` | Inventory of skills, tools, and JARVIS agents the gateway can invoke. |
| `CHANNEL_STRATEGY.md` | Tier 1 (WhatsApp, Telegram), Tier 2 (Slack), Tier 3 (iMessage, SMS) rollout plan. |

### Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `scripts/backup.sh` | Canonical source for `/home/tagai/.openclaw/backups/backup.sh` on the VPS. Daily agent-memory + runtime-config snapshot. Runs at 03:00 UTC via cron. |
| `scripts/sync-to-github.sh` | Canonical source for the cron job that age-encrypts + pushes each backup to `GusAI40/tagai-cloud-backups` as an orphan branch. Runs at 03:30 UTC. Fails loudly if any backup exceeds the GitHub 99 MB cap. |

### Investigation & phase notes

| File | Purpose |
|------|---------|
| `CLI_HEALTH_INVESTIGATION.md` | The CLI orphan-namespace bug + fix. |
| `PHASE3A_CLI_FIX.md` | Phase 3a CLI fix notes. |
| `PHASE4A_OVERLAY_APPLIED.md` | Phase 4a overlay rollout. |
| `PHASE4B_CLEANUP.md` | Phase 4b cleanup notes. |

### Diagnostic + dev scripts (top-level, legacy)

| File | Purpose |
|------|---------|
| `openclaw-healthcheck.sh` | One-shot health check for the gateway container. |
| `diag-telegram.sh`, `diag-telegram2.sh`, `diag-telegram3.sh`, `diag-telegram4.sh` | Telegram troubleshooting evolutions. |
| `maya-human-sim.sh`, `maya-test-harness.py`, `patch-maya-tools.py` | Maya voice agent simulation/test harness. |
| `smoke-test-msgraph.sh` | Microsoft Graph smoke test (calendar + email). |
| `webhook-handler.mjs`, `webhook-handler-current.mjs` | VAPI webhook handler used by `/opt/jarvis-vapi/` on the VPS. |
| `resend.json`, `supabase-snippet.json` | Reference snippets for Resend + Supabase integration. |

### Subdirectories

| Dir | Purpose |
|-----|---------|
| `scripts/` | Canonical VPS scripts (backup + sync). |
| `monitoring/` | Weekly health + upstream-drift snapshots. |
| `lobster/` | Legacy scratch — safe to ignore. |
| `rescue-patch-2026-05-12/` | One-off rescue-websites integration patches from 2026-05-12. |

## Branch Convention

- TAG changes land on branch `tagai-main`
- `main` tracks upstream `openclaw/main` for clean rebases
- Sync upstream: `git fetch upstream && git merge upstream/main`
- Push to `origin` (TAG fork) only. Never push to `upstream`.

## Authoritative Infra Reference

For server, networking, and Coolify details, see `C:\Users\gsanc\TAG-Projects-2026\_shared\docs\HETZNER_INFRASTRUCTURE.yaml` (machine-readable) and `_shared/docs/HETZNER_OVERVIEW_HUMAN.md` (human-readable).
