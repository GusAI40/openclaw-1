# Fleet Manifest — tagai-cloud

**Host:** Hetzner CPX21 @ `87.99.148.242` (hostname `tagai-cloud`)
**Operator:** Gus Sanchez (`wirelessgus@gmail.com`)
**Last updated:** 2026-05-11

This is the source-of-truth ledger for every tenant running on this host. **No secrets live here** — bot tokens, gateway tokens, and API keys stay in per-tenant `/home/tagai/tenants/<id>/openclaw/.env` (mode 600) on the VPS and in 1Password.

## Active tenants

| # | Tenant ID | Display Name | Owner Email | Public URL | Container | Gateway Port (loopback) | Bridge Port (loopback) | Telegram Bot | Bot ID | Authorized User IDs | Bootstrapped | Bootstrap Method | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `gus` (legacy `openclaw`) | Gus's Jarvis (production) | wirelessgus@gmail.com | https://openclaw.ubntag.com | `openclaw-openclaw-gateway-1` | 18789 | 18790 | @TAGAIWorkforceBot | (pre-fleet, see master `.tagai-env`) | 8603473262 | 2026-04-25 | manual (pre-`bootstrap-tenant.sh`) | All 11 plugin/MCP integrations live. Owns the shared infra accounts. |
| 2 | `julian` | Julian's Jarvis | julian@ubntag.com | https://julian.ubntag.com | `openclaw-julian-gateway` | 18884 | 19084 | @JujuJarvis_bot | 8763635904 | 8746285332 | 2026-05-11 | `bootstrap-tenant.sh julian julian.ubntag.com julian@ubntag.com` | First clean bootstrap. Plugins inherit Gus's tokens (Julian shares infra today). |

## Reserved / planned tenants

| Tenant ID | Notes |
|---|---|
| _(none yet)_ | When a slot is committed but not yet bootstrapped, list it here so port hashes don't collide |

## Port allocation (deterministic from `sha256(tenant_id)[0:4] % 99 + 1`)

| Tenant ID | Computed slot | Gateway Port | Bridge Port |
|---|---|---|---|
| `gus` (production — pre-fleet, manual) | n/a | 18789 | 18790 |
| `julian` | 84 | 18884 | 19084 |

If you ever change `bootstrap-tenant.sh`'s slot-allocation formula, update this table and audit for collisions.

## DNS records (Vercel — team `tag-ai-projects`)

All ubntag.com subdomains point directly to the VPS, bypassing Vercel's edge. A records added via Vercel REST API on 2026-05-11.

| Subdomain | Type | Value | TTL | Cert | Notes |
|---|---|---|---|---|---|
| openclaw | A | 87.99.148.242 | 60 | LE | Pre-existing, working since project start |
| julian | A | 87.99.148.242 | 60 | LE | Added 2026-05-11 |
| cma | A | 87.99.148.242 | 60 | LE | Added 2026-05-11 (was on Vercel edge, returning 404) |
| voiceai | A | 87.99.148.242 | 60 | LE | Added 2026-05-11 (was on Vercel edge, returning 404) |

## Shared infrastructure (host-wide)

| Resource | Lives in | Used by | Rotation impact |
|---|---|---|---|
| OpenAI / Anthropic / DeepSeek / Groq / Mistral / Gemini API keys | `/home/tagai/.openclaw-shared.env` | All tenants | 1 file edit, restart containers |
| LiveKit Cloud project | shared.env | All tenants (room prefix per-tenant) | 1 file edit |
| Telnyx trunk (SIP) | shared.env | All tenants (DID per-tenant — currently shared trunk number) | 1 file edit |
| Cartesia / Deepgram (voice) | shared.env | All tenants | 1 file edit |
| Microsoft Graph (TAG MS tenant) | shared.env | All tenants | 1 file edit |
| Supabase | per-service (NOT shared — 3+ projects in use) | varies | per-project rotation |
| Resend | per-service (3 legitimate domains) | varies | per-domain rotation |
| Vercel deploy token | shared.env | All tenants | 1 file edit |

## Backup state

| | Location | Encryption | Retention | Cron |
|---|---|---|---|---|
| Local snapshot | `/home/tagai/.openclaw/backups/backup-*/` | none (local-only) | 7 days | `0 3 * * *` |
| Off-site (encrypted) | `GusAI40/tagai-cloud-backups` GitHub repo, branch `backup-YYYYMMDD-HHMMSS` | age (recipient pubkey in `scripts/age-public-key.txt`) | none (manual prune > 90d planned) | `30 3 * * *` |

**The backup script auto-discovers tenants** — drop a new tenant via `bootstrap-tenant.sh` and the next 3 AM cron run will start backing up that tenant's `.openclaw/` automatically. No manual configuration per tenant required.

Critical caveat: the age private key (decryption) lives at `/home/tagai/.openclaw/backups/.age-key.txt` on the VPS AND should also live in 1Password Secure Note titled "age key — tagai-cloud backups". Without that copy, every off-site backup is unrecoverable if the VPS disk fails.

## Adding a new tenant — checklist

1. **DNS:** Add A record `<tenant_id>.ubntag.com → 87.99.148.242` on Vercel (Vercel team `tag-ai-projects`)
2. **Bootstrap on VPS:** `ssh tagai@tagai-cloud /home/tagai/openclaw-bootstrap/bootstrap-tenant.sh <tenant_id> <tenant_id>.ubntag.com <owner@email>`
   - Script auto-generates gateway token, allocates loopback ports from `sha256(tenant_id)`, renders openclaw.json with `meta.lastTouchedVersion` pinned to current image, seeds 100-agent corp roster with `<tenant_id>-` prefix, installs Caddy site block, recreates container
3. **Telegram bot:** Message @BotFather → `/newbot` → get token. Get owner's numeric Telegram ID from @userinfobot.
4. **Wire bot:** Edit `/home/tagai/tenants/<tenant_id>/openclaw/.env`:
   ```
   TELEGRAM_BOT_TOKEN=<from-botfather>
   TELEGRAM_ALLOWED_USERS=<owner-numeric-id>
   ```
   Then: `cd /home/tagai/tenants/<tenant_id>/openclaw && docker compose up -d --force-recreate openclaw-gateway`
5. **Owner pairs bot:** Owner messages the new bot on Telegram → bot replies with pairing code → operator runs:
   ```
   docker exec openclaw-<tenant_id>-gateway node dist/index.js pairing approve telegram <code>
   ```
6. **Verify:**
   - `curl https://<tenant_id>.ubntag.com/` → 200 with valid LE cert
   - Owner sends a follow-up Telegram message, gets a real Jarvis reply (not another pairing code)
7. **Log:** Append the new tenant row to the "Active tenants" table above. Commit + push this manifest.
8. **Backups:** Nothing — already automatic via the next 3 AM cron.

Estimated time per tenant after #3: **5–8 minutes** (most spent in BotFather + waiting for Vercel DNS propagation).

## 2026-05-12 Updates — Julian operational + auth fix landed

- **DeepSeek auth fix:** Julian's tenant was falling back to Gemini because `agents/main/agent/auth-profiles.json` was missing. Hot-fix applied (copied from Gus's). Permanent fix committed to `bootstrap-tenant.sh` step 8.5 (commit `2237db8b79`). Template files live at `/home/tagai/openclaw-bootstrap/_template/agents-main-agent/` on VPS (NOT in git — they hold raw LLM provider keys).
- **Device-pair auto-approve cron:** every 30s, `/home/tagai/auto-approve-julian-devices.sh` sweeps `tenants/julian/.openclaw/devices/pending.json` and moves entries to `paired.json`. Removes browser-pairing friction for Julian. **Single-factor security** — anyone with the gateway token can pair within 30s. Fine for inner-circle; NOT acceptable for paying tenants. Toggle off for tenant #N (where N > 2 and external).
- **All 3 of Julian's devices paired** (2× Win32 — Gus's incognito test browser; 1× MacIntel — Julian's actual browser). Both Gus + Julian can hit https://julian.ubntag.com/ via web UI.
- **`controlUi.allowedOrigins` parameterized in bootstrap template** (commit `7c389ad085` covered this for julian.conf in Caddyfile; openclaw.json template patched in `36ec7a7d37` to use `{{DOMAIN}}` + `{{GATEWAY_PORT}}`).

## Future enhancements (not blocking, but track here)

- **`{{REDACT_FILL_AT_DEPLOY}}` placeholder fill in bootstrap-tenant.sh:** the redacted openclaw.json.tpl leaves 11 plugin/MCP secret placeholders unfilled. Julian inherited working values because his template render happened before redaction. Tenant #3+ will need either a script enhancement (auto-fill from shared.env at render time) OR a manual post-bootstrap step.
- **Per-tenant Telnyx DID:** All tenants currently share TAG's trunk. For caller-ID per tenant, provision a DID in Telnyx and set `TELNYX_PHONE_NUMBER=` per-tenant in their .env.
- **Per-tenant Resend domain:** Same model as Telnyx — currently shared (or Gus's 1 domain). When a tenant needs their own sender reputation, provision a Resend domain + key, set `RESEND_API_KEY=` per-tenant.
- **Weekly remote-branch prune** on `tagai-cloud-backups` (90-day retention).
- **`list-tenants.sh` enhancement:** script exists but only reads from `/home/tagai/tenants/`. Cross-reference this manifest for human-readable display names and bot usernames.
- **Shared-projects integration (rescue-websites + awesome-design-md):** plan documented in `integration-plans/REPO-INTEGRATION-PLAN.md`. Pending Gus's GitHub fork action, then 10-15 min execution in next session.
- **Backup script needs `/home/tagai/openclaw-bootstrap/_template/agents-main-agent/`** included — those auth files are critical infra (without them, new tenants have no LLM access). Currently not in backup path.
- **`auto-approve-{tenant}-devices.sh` only exists for julian.** When tenants #3+ are inner-circle, replicate. When external/paying, do NOT install (require manual device approval per browser).

## Out-of-band channels (not tenant-scoped)

For completeness — these are host-wide services that don't belong to any single tenant:

| Service | What | Used by |
|---|---|---|
| `jarvis-vapi-webhook.service` (systemd) | VAPI webhook handler on `127.0.0.1:18792` | All tenants via Caddy `/vapi/*` path matcher |
| `voiceai-server` (root PM2) | TAG voice tools API on `127.0.0.1:3000` | Caddy serves `voiceai.ubntag.com` |
| `michelle-cma` container | CMA reports API on `127.0.0.1:8080` | Caddy serves `cma.ubntag.com` |
| `tour-book` container | Tour book API on container-only `8001` | (currently not externally reachable — port not host-bound) |
