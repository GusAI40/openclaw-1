# _tagai/ — TAG AI Overlay Layer

## Purpose

This folder contains all TAG-AI-specific customization for the OpenClaw fork (`GusAI40/openclaw-1`). Everything that is **not** part of the upstream OpenClaw project lives here: deployment configs for Hetzner, channel routing strategy, capability inventory, onboarding playbooks, and Claude Code instructions for this repo.

## Why Separated

The repo root tracks upstream OpenClaw (`openclaw/openclaw`). Keeping our customization isolated in `_tagai/` lets us:

- Rebase cleanly against upstream without merge conflicts
- See exactly what TAG added vs what the upstream project ships
- Pull upstream improvements with `git fetch upstream && git merge upstream/main`
- Avoid polluting files (Dockerfile, package.json, apps/, etc.) that the upstream maintainers iterate on

The repo root `CLAUDE.md` is upstream's. Our Claude instructions live at `_tagai/CLAUDE.md`.

## Files in This Folder

| File | Purpose |
|------|---------|
| `README.md` | This file. Overview of the overlay layer. |
| `CLAUDE.md` | Instructions for future Claude Code sessions opening this repo. |
| `INTEGRATION.md` | How OpenClaw fits into the broader TAG AI stack (JARVIS, Supabase, Hetzner). |
| `HEALTH.md` | Service health endpoints, status checks, and runbook. |
| `DEPLOY_HETZNER.md` | Step-by-step deployment to Hetzner via Coolify. Domain, ports, DNS. |
| `docker-compose.tagai.yml` | Compose overlay layered on top of upstream `docker-compose.yml`. |
| `.env.tagai.example` | Reference list of all TAG-specific env vars. Real values live on the server. |
| `CAPABILITIES.md` | Inventory of skills, tools, and JARVIS agents the OpenClaw gateway can invoke. |
| `CHANNEL_STRATEGY.md` | Tier 1 (WhatsApp, Telegram), Tier 2 (Slack), Tier 3 (iMessage, SMS) rollout plan. |
| `ONBOARD_PLAYBOOK.md` | Operator runbook for the `openclaw onboard` command. |

Some of these files may be in flight while parallel agents complete the overlay; treat the table above as the canonical inventory.

## Branch Convention

- TAG changes land on branch `tagai-main`
- `main` tracks upstream `openclaw/main` for clean rebases
- Sync upstream: `git fetch upstream && git merge upstream/main`
- Push to `origin` (TAG fork) only. Never push to `upstream`.

## Authoritative Infra Reference

For server, networking, and Coolify details, see `C:\Users\gsanc\TAG-Projects-2026\_shared\docs\HETZNER_INFRASTRUCTURE.yaml` (machine-readable) and `_shared/docs/HETZNER_OVERVIEW_HUMAN.md` (human-readable).
