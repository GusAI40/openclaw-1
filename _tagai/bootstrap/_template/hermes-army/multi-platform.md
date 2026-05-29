# Skill: Multi-Platform Gateway Coordinator (tenant: {{TENANT_ID}})
# Self-improving: Tracks platform response times, auto-routes to fastest channel.

## Description
Coordinate task delivery across Telegram, web, and voice platforms — scoped to tenant `{{TENANT_ID}}` ({{TENANT_NAME}}).

## Channels (per-tenant)
- **Telegram**: tenant-owned bot (env: `TENANT_TELEGRAM_BOT_TOKEN`), allowed users: `TENANT_TELEGRAM_ALLOWED_USERS`
- **Web**: https://{{DOMAIN}}/hermes (CORS-locked to {{DOMAIN}} origin only)
- **Voice**: LiveKit room prefix `room-{{TENANT_ID}}-*` (shared LiveKit Cloud project, but rooms are tenant-namespaced)
- **CLI**: `docker exec -it openclaw-{{TENANT_ID}}-gateway hermes -z "task"`

## Routing Logic
1. Read task urgency from `task.metadata.urgency` (low | normal | high | urgent)
2. Read platform response-time stats from `/home/node/.openclaw/hindsight/platform-rt.json`
3. Route urgent tasks to the fastest available channel
4. Route normal tasks to the owner's preferred channel (configured in {{TENANT_ID}}'s `identity/preferences.json`)
5. Log delivery + response time back to `platform-rt.json` for the next round

## Hard Gate
The Telegram bot for tenant `{{TENANT_ID}}` MUST reject messages from any user_id not in `TENANT_TELEGRAM_ALLOWED_USERS`. Cross-tenant leakage via shared Telegram infrastructure is the #1 risk this skill prevents.

## Auto-Optimization
- Tracks response time per platform (Telegram, web, voice)
- Updates `platform-rt.json` every 50 messages
- Auto-disables a channel if it returns >3 consecutive errors
