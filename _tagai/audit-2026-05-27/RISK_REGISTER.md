# Risk Register — TAG / OpenClaw

**Audit date:** 2026-05-27. **Scope:** TAG-owned layers.

Severity scale: **Critical** (active outage / silent revenue loss), **High** (one-incident-away), **Medium** (drift), **Low** (cleanup).

---

## Critical

### R-1 — Gus main has invalid Anthropic fallback model IDs

- **What.** `/home/tagai/.openclaw/openclaw.json:agents.defaults.model.fallbacks` lists `anthropic/claude-haiku-4.5` and `anthropic/claude-sonnet-4.6` — **dots**, not dashes. Anthropic API rejects dotted IDs (verified against [docs](https://platform.claude.com/docs/en/docs/about-claude/models/overview) 2026-05-27). Valid forms are `claude-haiku-4-5` and `claude-sonnet-4-6`.
- **Why bad now.** Today (2026-05-27) two other steps in the fallback chain are also broken: Google AI image-gen key expired, OpenAI image-gen hit billing hard limit. The Claude fallback is supposed to be the safety net, and it's broken too.
- **Cost.** Silent failures the moment DeepSeek throttles. Gus loses Jarvis with no failover. Every workstream Gus runs through Jarvis slows down.
- **Fix.** `sed -i 's/claude-haiku-4\.5/claude-haiku-4-5/g; s/claude-sonnet-4\.6/claude-sonnet-4-6/g' /home/tagai/.openclaw/openclaw.json && docker compose -f /home/tagai/openclaw/docker-compose.yml restart openclaw-gateway`. 5 minutes.
- **Reference.** Anthropic models doc 2026-05-27; this audit verified the live state on the box.

---

## High

### R-2 — Agent lane jam (heartbeat + long tool calls) silently swallows Telegram messages

- **What.** Long tool chains (Julian's video gen + Cloudflare deploy today; heartbeat cron storms on 2026-05-22) wedge `agent:main:main` in `processing` state. Telegram poller still runs, getUpdates still consumes messages, but they queue behind the wedged session and never get processed. Diagnostic line `[diagnostic] stuck session: ... state=processing age=Ns queueDepth=K` fires but no action is taken.
- **Cost.** Tenant looks healthy to the user (bot online, no errors). User messages just disappear. Already burned Julian twice in 6 days.
- **Fix.** Add a watchdog in the runtime: if `state=processing age>=180s` for the same `sessionKey` is logged twice in 10 minutes, auto-archive the session JSONL + drop the lock, and emit a `session quarantined` event. Manual recovery is what I did today — 5 SSH commands, ~10 minutes. Automated recovery should be seconds.
- **Reference.** This audit's incident at 14:08 UTC; prior incident 2026-05-22 (memory: `project_session_log_2026_05_22.md`).

### R-5 — Single-VPS Hetzner — no warm standby

- **What.** Everything TAG runs (Gus main Jarvis, Julian Jarvis, brightsmile voice demo, all per-tenant data) lives on one Hetzner CPX21. No HA, no failover.
- **Cost.** A Hetzner region outage = total dark. Probably hours, not days, but during business hours that's real lost throughput.
- **Fix.** Two options. (a) Document the recovery drill from the GitHub-stored age-encrypted backups — at minimum, prove you can restore one tenant to a fresh VPS in under an hour. (b) Spin a warm-standby on a second provider (DigitalOcean, etc.) that pulls from the same backup branch nightly.
- **Reference.** Off-site backup paths in MEMORY.md.

### R-6 — Tenant bootstrap script is tribal knowledge (not in this repo)

- **What.** `bootstrap-tenant.sh` lives on the VPS at `/home/tagai/openclaw-bootstrap/bootstrap-tenant.sh`, not in this repo. Same for the `_template/` directory it seeds from.
- **Cost.** If the VPS dies and you have to rebuild, the recovery path requires not just data restoration but also re-creating the bootstrap pattern. That's a multi-hour reconstruction window.
- **Fix.** Promote `bootstrap-tenant.sh` and `_template/` into `_tagai/scripts/` (or a sister `_tagai/bootstrap/`). Then a `git clone` of this repo + a backup restore is enough to recover.
- **Reference.** MEMORY.md → "Bootstrap a new tenant" line.

### R-7 — Device-pair auto-approve cron is a single-factor security relax

- **What.** `/home/tagai/auto-approve-julian-devices.sh` runs every 30s and auto-approves any new device-pair request for Julian's tenant. Anyone with the gateway token + access to Julian's domain gets paired. Memory note explicitly says: "Single-factor — anyone with gateway token gets paired. Do NOT install for paying tenants."
- **Cost.** Today: limited (Julian is internal). Future: blocks the per-tenant SaaS product from shipping safely.
- **Fix.** Replace the cron with a real one-time approval challenge (email OTP, SMS, second-channel ping) per new device. The device-pair plugin already gives you the hook; this is implementation, not architecture.
- **Reference.** MEMORY.md → "Device-pair is a CORE security gate."

### R-9 — `rescue-websites-sim` flagged 3 bugs that are still in the live pipeline

- **What.** `rescue-websites-sim/migrations/001-add-tenant-isolation.sql` is explicitly marked "PROPOSAL — DO NOT APPLY UNTIL SIMULATOR VALIDATES." The sim exists, the bugs are documented, the migration is written. **Nobody has run the validation pass that authorizes applying the migration to live Supabase.**
- **Cost.** Three real risks remain in the live pipeline: (a) friendly fire — two TAG tenants both email the same business; (b) hard-vs-soft unsub — no schema distinction between CAN-SPAM stop and "defer until Tuesday"; (c) reputation burn — shared sender domain `ubntag.com` torches deliverability for E-Rate, Spectrum, copper-send, etc., on one bad blast.
- **Fix.** Run `npm run sim:full`. Confirm bugs surface. Apply migration to live Supabase. Estimate: 30 minutes of focused work.
- **Reference.** `rescue-websites-sim/README.md` and `rescue-websites-sim/migrations/001-add-tenant-isolation.sql`.

### R-13 — Image/video generation broken — RESOLVED 2026-05-28

- **What (original).** Image-gen candidate chain was dead: Google key returned `API key expired`, OpenAI `gpt-image-2` returned `billing hard limit reached`.
- **Validated root causes (live docs + box, 2026-05-28):**
  1. The Google key was **not** time-expired. Google's policy (effective 2026-05-07) **blocks unrestricted dormant keys**; all keys must be **restricted by 2026-06-19**. The old unrestricted key got caught by this.
  2. **The real auth source was the env var, not auth-profiles.json.** OpenClaw media providers read the Google key from `GEMINI_API_KEY`/`GOOGLE_API_KEY` env (sourced from `.openclaw-shared.env`), which still held the dead key. The first rotation only touched `auth-profiles.json`, so it was incomplete.
  3. `gpt-image-2` is the **current valid** OpenAI model — the only issue was the account billing limit (since cleared). Do NOT drop it.
- **Fix applied.** `setup-media-providers.py` synced the working keys into BOTH sources (shared env + auth-profiles) on both tenants, and set: images `openai/gpt-image-2` → `google/gemini-3.1-flash-image` → `google/gemini-2.5-flash-image`; video `google/veo-3.1-fast-generate-preview` → `google/veo-3.0-fast-generate-001`. Containers force-recreated (env change needs recreate, not restart).
- **Proven end-to-end** through `openclaw agent`: real 755 KB PNG (gpt-image-2) and real 3.3 MB MP4 (veo-3.1-fast, header `ftypisom`).
- **Open follow-up (you-action):** restrict the new Google key to the Generative Language API before **2026-06-19** or it gets blocked like the old one. Tracked as [[validate-against-live-docs]] discipline win.
- **Reference.** Gemini API key docs, image-generation docs, video-generation docs, pricing — all validated 2026-05-28; this session's runtime tests.

---

## Medium

### R-3 — Schema clobber on image upgrade

- **What.** `openclaw.json.meta.lastTouchedVersion` must equal the running image's `/app/package.json` version on boot. The runtime treats mismatch as "we wrote this with an older binary, time to reset some fields." Bumping the image without bumping `lastTouchedVersion` first clobbers the schema. Currently pinned at `2026.4.25`.
- **Cost.** One bad image upgrade nukes per-tenant config. There's a backup folder with `.clobbered.*` files for a reason — it's been hit 6+ times.
- **Fix.** `bootstrap-tenant.sh` step pins this correctly for new tenants. For existing tenants on the box, document the pre-flight: bump `lastTouchedVersion` BEFORE `docker compose pull`.
- **Reference.** MEMORY.md → "Schema-clobber fix (2026-05-11)."

### R-4 — `auth-profiles.json` is not in version control

- **What.** Per-tenant LLM credentials live at `agents/main/agent/auth-profiles.json`, mode 600, NOT in git. Without this file, runtime fails over `deepseek → gemini` forever. Seeded by `bootstrap-tenant.sh` step 8.5 from `/home/tagai/openclaw-bootstrap/_template/agents-main-agent/`.
- **Cost.** If the VPS disk dies and the age key isn't in 1Password, this file is gone forever. Every tenant has to re-create their LLM creds.
- **Fix.** Confirm the age key is in 1Password under a recoverable vault, not only on the box. Do an annual recovery drill.
- **Reference.** MEMORY.md → "LLM auth lives in `agents/main/agent/auth-profiles.json`."

### R-8 — DNS lives on Vercel — past sessions confused this with Cloudflare

- **What.** `ubntag.com` zone is on Vercel DNS, not Cloudflare. Adding a new tenant subdomain requires an A record `<id>.ubntag.com → 87.99.148.242` on Vercel before bootstrap-tenant runs.
- **Cost.** Lost Vercel credentials = blocked tenant onboarding until restored.
- **Fix.** Document Vercel DNS as the system of record in `_tagai/DEPLOY_HETZNER.md`. Confirm credentials in 1Password.

### R-10 — Julian's MCP servers configured-but-not-running

- **What.** Julian's `openclaw.json` references 12 MCP servers (restored from the 2026-05-12 backup), but the program files don't exist under `/home/tagai/tenants/julian/.openclaw/mcp-servers/`. Only Gus's tenant has them at `/home/tagai/.openclaw/mcp-servers/`.
- **Cost.** Logs look healthy; Jarvis silently lacks MCP capability for Julian. Misleading.
- **Fix.** Either bind-mount Gus's `mcp-servers/` into Julian's tenant compose, or strip the dead config from Julian's `openclaw.json`.
- **Reference.** This audit + MEMORY.md → 2026-05-18 entry.

### R-11 — Stale rescue-patch directory (un-merged for 2+ weeks)

- **What.** `_tagai/rescue-patch-2026-05-12/` has src/outreach/email.ts, extract-email.ts, pipeline.ts — patches for the live rescue-websites pipeline. Never merged. No README of intent.
- **Cost.** Future engineer will assume this is live code, edit it, then discover it's parked.
- **Fix.** Diff against `/home/tagai/shared-projects/rescue-websites/`. Land what's good. Delete the rest. Or add a `README.md` explaining what's parked and why.

---

## Low

### R-12 — Duplicate webhook handlers

- **What.** `_tagai/webhook-handler.mjs` and `_tagai/webhook-handler-current.mjs` are both 318 lines and structurally identical.
- **Fix.** Pick the one running on the box. Delete the other. Add a comment naming the one in use.

### R-14 — Stale Coolify/Traefik mentions in `.env.tagai.example`

- **What.** `_tagai/.env.tagai.example` lines 5-6, 35 still mention Coolify and Traefik. `_tagai/CLAUDE.md` explicitly says this is Caddy-only, not Coolify, not Traefik. The example is documentation-stale.
- **Fix.** Strip the mentions. Add a top comment: "This deploy is plain `docker compose` + Caddy on the host. No Coolify, no Traefik."

### R-15 — Multiple `diag-telegram*.sh` scripts (v1-v4) in `_tagai/`

- **What.** Four evolving diagnostic scripts for the same Telegram issue.
- **Fix.** Keep the most recent (v4) as the canonical diag. Move the rest to `_tagai/archive/` or delete. The pattern (Telegram silent → check tokens → check polls) is captured in MEMORY.md so it's not at risk.

### R-16 — Half-finished Maya agent harness

- **What.** `_tagai/maya-human-sim.sh`, `maya-test-harness.py`, `patch-maya-tools.py` — references a Maya voice agent that lives in a different (`voice-agent-demo`) repo. CLAUDE.md says "The voice agent project name is **Maya** (not 'Mia')."
- **Fix.** Either complete the integration or move these files to the `voice-agent-demo` repo where Maya actually lives. They're orphaned here.

---

## Severity rollup

| Severity | Count | Open |
|---|---|---|
| Critical | 0 | — (R-1 fixed 2026-05-28) |
| High | 5 | R-2, R-5, R-6, R-7, R-9 |
| Medium | 5 | R-3, R-4, R-8, R-10, R-11 |
| Low | 4 | R-12, R-14, R-15, R-16 |

**Resolved 2026-05-28:** R-1 (dotted Claude IDs), Gus Telegram model-override jam, R-13 (image+video generation).

**13 open risks remain.** **Highest leverage next: R-2 (lane-jam watchdog — already bit both tenants) and R-9 (sim migration — kills 3 live-pipeline bugs).**
