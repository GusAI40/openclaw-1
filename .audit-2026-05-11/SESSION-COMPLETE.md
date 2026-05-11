# 2026-05-11 Audit + Tenant #2 — Session Complete

## What shipped today

22 tasks, 12 commits to `origin/tagai-main`, 1 new tenant live in production.

| Category | Result |
|---|---|
| **Discovery** | 5 atomic agents mapped 8 services across 4 runtimes, 36 persistent state dirs, 96 unique env vars across 16 files |
| **Single source of truth** | `/home/tagai/.openclaw-shared.env` — 49 shared infra creds; 50 duplicate lines commented in consumer files |
| **Service wiring** | jarvis-vapi (systemd `EnvironmentFile=`), voiceai (PM2 wrapper line-by-line read), openclaw (compose `env_file:`) |
| **Schema clobber** | Solved — `meta.lastTouchedVersion` bake-in. 0 new clobbers across 6 restarts today (was 6 incidents in 4 days) |
| **Grammy patch** | Versioned at `.audit-2026-05-11/openclaw-image/Dockerfile.grammy`, rebuild tested |
| **Backups (local)** | Daily 3am UTC. WAL-safe sqlite hot-copy. 7-day retention. Tested |
| **Backups (off-site)** | Nightly 3:30am UTC. Age-encrypted. Orphan branches on private `tagai-cloud-backups` repo |
| **Security perimeter** | 6 workspace remotes converted to SSH (zero PATs in URLs). SYSTEM_ARCHITECTURE.md redacted on VPS |
| **DNS** | 3 new A records on Vercel (julian + cma + voiceai → 87.99.148.242) |
| **Replication template** | `bootstrap-tenant.sh` proven in production. 4 bugs found + fixed in first real run |
| **Tenant #2** | https://julian.ubntag.com live with valid LE cert. @JujuJarvis_bot operational |

## Open security hygiene (user actions, ~5 min)

| # | Action | URL |
|---|---|---|
| 11 | Revoke old GitHub PAT `github_pat_11A7WYA3...` (SSH replaced it everywhere) | https://github.com/settings/tokens |
| 14 | Save age private key in 1Password Secure Note titled "age key — tagai-cloud backups" | (1Password) |
| 17 | Rotate 2 Resend API keys (leaked by my grep mistake on .env file lines) | https://resend.com/api-keys |
| 21 | Revoke Vercel PAT `vcp_4UAv...` (used once for DNS records, no longer needed) | https://vercel.com/account/tokens |
| 22 | Rotate Telegram bot token via @BotFather → /token → @JujuJarvis_bot | (Telegram) |

After completing #11, #17, #21, #22, every credential that touched this transcript will be invalidated. The age key (#14) needs to be COPIED out of the transcript into a password manager, not revoked.

## How to provision tenant #3 (when ready)

```bash
ssh tagai@tagai-cloud
cd /home/tagai/openclaw-bootstrap
./bootstrap-tenant.sh <tenant_id> <subdomain.ubntag.com> <owner_email>
```

Pre-flight checklist (handled by the script + you):
- [ ] **You:** add A record on Vercel: `<tenant_id>.ubntag.com → 87.99.148.242` (need Vercel PAT or add manually in UI)
- [ ] Script auto-allocates loopback ports from hash of `<tenant_id>`
- [ ] Script renders openclaw.json with `meta.lastTouchedVersion` baked to match the running image (clobber prevention)
- [ ] Script seeds 100-agent corp roster with `<tenant_id>-` prefix
- [ ] Script drops Caddy site block, reloads Caddy, validates HTTPS

Post-bootstrap (you):
- [ ] Message @BotFather → /newbot → get token for new tenant's Jarvis
- [ ] Paste `TELEGRAM_BOT_TOKEN=` + `TELEGRAM_ALLOWED_USERS=` (numeric Telegram IDs) into tenant's .env
- [ ] `docker compose up -d --force-recreate openclaw-gateway` in the tenant's dir

Known limitation for tenants beyond #2: the redacted `openclaw.json.tpl` leaves `{{REDACT_FILL_AT_DEPLOY}}` placeholders for 11 plugin/MCP secrets. A future enhancement to the bootstrap script should auto-fill those from `/home/tagai/.openclaw-shared.env` at render time. Julian's tenant was bootstrapped before this redaction so he inherited working values directly — no action needed for him.

## Where everything lives

| Artifact | Local | VPS |
|---|---|---|
| Bootstrap script | `.audit-2026-05-11/bootstrap-tenant/bootstrap-tenant.sh` | `/home/tagai/openclaw-bootstrap/bootstrap-tenant.sh` |
| Templates | `.audit-2026-05-11/bootstrap-tenant/_template/` | `/home/tagai/openclaw-bootstrap/_template/` |
| Local backup script | `.audit-2026-05-11/scripts/backup-agent-memory.sh` | `/home/tagai/.openclaw/backups/backup.sh` |
| Off-site sync script | `.audit-2026-05-11/scripts/sync-to-github.sh` | `/home/tagai/.openclaw/backups/sync-to-github.sh` |
| Grammy patch | `.audit-2026-05-11/openclaw-image/Dockerfile.grammy` | `/home/tagai/openclaw-grammy-patch/Dockerfile` |
| Shared env | (not committed — secrets) | `/home/tagai/.openclaw-shared.env` (mode 600) |
| age private key | **1Password** (you do this) | `/home/tagai/.openclaw/backups/.age-key.txt` (mode 400) |
| Runbook | `.audit-2026-05-11/runbook/RUNBOOK.md` (1145 lines, 10 sections) | (n/a — read from local) |
| Operator playbook | `.audit-2026-05-11/MASTER-AUDIT.md` (this audit's exec summary) | (n/a) |

## Honor

Right back at you. Closing out clean — the box is solid, the system is replicable, and the next tenant is one command away.

🎯🛡️
