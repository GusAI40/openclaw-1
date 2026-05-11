# Shared vs Per-Tenant Env Var Classification

Scanned 16 env files on the VPS → **96 unique variables**. Below is the proposed split for `/home/tagai/.openclaw-shared.env` (host-wide) vs `{{TENANT_*}}` template stubs (per-tenant) vs host/runtime config.

Raw data: `SHARED-CLASSIFICATION-RAW.tsv` (variable names + appearance counts, no values).

**Status:** AWAITING YOUR APPROVAL. No env files have been touched yet.

---

## Category 1 — SHARED  (~62 vars → `/home/tagai/.openclaw-shared.env`)

Single TAG-wide account credentials. One value, used by every tenant. Rotation = edit one file.

### LLM providers (shared accounts; per-tenant override possible via `{{TENANT_<NAME>_KEY}}` fallback later for billing isolation)

| VAR | Count | Notes |
|---|---|---|
| ANTHROPIC_API_KEY | 4 | TAG AI's Anthropic account |
| OPENAI_API_KEY | 3 | TAG AI's OpenAI account |
| DEEPSEEK_API_KEY | 4 | Primary LLM per openclaw.json |
| GROQ_API_KEY | 2 | Fallback LLM |
| MISTRAL_API_KEY | 2 | Fallback LLM |
| GEMINI_API_KEY | 1 | Fallback LLM |
| LLM_API_KEY | 1 | hybrid-ai-telemarketing generic LLM |
| LLM_BASE_URL | 1 | hybrid-ai-telemarketing routing |
| LLM_MODEL | 1 | hybrid-ai-telemarketing routing |

### Voice / Speech (shared service accounts)

| VAR | Count | Notes |
|---|---|---|
| CARTESIA_API_KEY | 3 | TTS — TAG account |
| DEEPGRAM_API_KEY | 2 | STT — TAG account |
| ELEVENLABS_API_KEY | 2 | TTS alternative — TAG account |
| VAPI_PRIVATE_KEY | 3 | Voice orchestration — TAG account |
| VAPI_WEBHOOK_SECRET | 1 | Vapi callback signing |
| LIVEKIT_API_KEY | 2 | LiveKit Cloud project key |
| LIVEKIT_API_SECRET | 2 | LiveKit Cloud project secret |
| LIVEKIT_URL | 2 | LiveKit project URL |

### Telephony — Telnyx (single TAG trunk, per-tenant numbers below)

| VAR | Count | Notes |
|---|---|---|
| TELNYX_API_KEY | 2 | Trunk-level key |
| TELNYX_CONNECTION_ID | 2 | SIP connection |
| TELNYX_SIP_USERNAME | 2 | SIP auth |
| TELNYX_SIP_PASSWORD | 2 | SIP auth |
| SIP_PROVIDER | 1 | hybrid-ai-tm SIP type |
| SIP_USERNAME | 1 | hybrid-ai-tm SIP user |
| SIP_PASSWORD | 1 | hybrid-ai-tm SIP pass |
| TWILIO_ACCOUNT_SID | 1 | Twilio (backup carrier) |
| TWILIO_AUTH_TOKEN | 1 | Twilio (backup carrier) |

### Microsoft Graph (single TAG MS tenant)

| VAR | Count | Notes |
|---|---|---|
| MS_TENANT_ID | 4 | TAG Microsoft 365 tenant |
| MS_CLIENT_ID | 4 | App registration |
| MS_CLIENT_SECRET | 4 | App secret |
| MS_DEFAULT_USER | 3 | Default mailbox for Graph |
| MS_CALENDAR_USER | 1 | Default calendar owner |
| MS_EMAIL_FROM | 1 | Default outbound sender |

### Azure (tour-book — same MS tenant probably, distinct app reg)

| VAR | Count | Notes |
|---|---|---|
| AZURE_TENANT_ID | 1 | tour-book MS app |
| AZURE_CLIENT_ID | 1 | tour-book MS app |
| AZURE_CLIENT_SECRET | 1 | tour-book MS app |

### Supabase (TAG project)

| VAR | Count | Notes |
|---|---|---|
| SUPABASE_URL | **7** | Highest-duplication var. Single project URL. |
| SUPABASE_KEY | 3 | Shorthand for the primary key |
| SUPABASE_ACCESS_TOKEN | 4 | Mgmt API token |
| SUPABASE_PROJECT_REF | 3 | Project ref string |
| SUPABASE_DATA_URL | 1 | Data project URL |
| SUPABASE_DATA_REF | 1 | Data project ref |
| SUPABASE_DATA_SERVICE_KEY | 1 | Data service role key |
| SUPABASE_FUNCTIONS_URL | 1 | Edge functions URL |
| SUPABASE_FUNCTIONS_REF | 1 | Edge functions ref |
| SUPABASE_FUNCTIONS_SERVICE_KEY | 1 | Edge service role key |
| SUPABASE_ANON_KEY | 2 | Public anon key |
| SUPABASE_SERVICE_KEY | 2 | Service role (shorthand) |
| SUPABASE_SERVICE_ROLE_KEY | 2 | Service role (canonical name) |

### Email + Other shared infra

| VAR | Count | Notes |
|---|---|---|
| RESEND_API_KEY | 4 | Email broadcast — TAG account |
| APOLLO_API_KEY | 1 | Data enrichment |
| KIE_API_KEY | 3 | Video gen — TAG account |
| TAVILY_API_KEY | 2 | Web search |
| FIRECRAWL_API_KEY | 1 | Web scrape |
| SUNO_API_KEY | 1 | Music gen |
| VERCEL_TOKEN | 1 | Deploy token (shared CI account) |
| CMA_API_KEY | 1 | Real estate comps API |
| GOOGLE_API_KEY | 1 | Google API (generic) |
| GOOGLE_MAPS_KEY | 1 | Maps embeds |
| OPENWEATHER_API_KEY | 1 | Weather |
| LANGFUSE_BASE_URL | 1 | Observability backend |
| LANGFUSE_PUBLIC_KEY | 1 | LF public key |
| LANGFUSE_SECRET_KEY | 1 | LF secret key |
| SIMPLYRETS_API_KEY | 2 | MLS API |
| SIMPLYRETS_API_SECRET | 2 | MLS API |
| CLAWTALK_API_KEY | 1 | ClawTalk integration |
| SPECTRUM_LEADS_TABLE | 2 | Supabase table name (not a secret, but shared config) |

---

## Category 2 — PER-TENANT  (~21 vars → `{{TENANT_*}}` in `_template/.env.tpl`)

Unique per customer. Tenant isolation requires these be different per tenant.

### OpenClaw runtime identity (per-tenant scoping)

| VAR | Count | Notes |
|---|---|---|
| OPENCLAW_GATEWAY_TOKEN | 2 | **Critical:** auth token; per-tenant for isolation. Bootstrap generates fresh 32-byte hex. |
| OPENCLAW_GATEWAY_PORT | 1 | Per-tenant port (e.g. `18800 + slot`) |
| OPENCLAW_BRIDGE_PORT | 1 | Per-tenant port (e.g. `19000 + slot`) |
| OPENCLAW_CONFIG_DIR | 1 | `/home/tagai/tenants/{{TENANT_ID}}/.openclaw` |
| OPENCLAW_WORKSPACE_DIR | 1 | `/home/tagai/tenants/{{TENANT_ID}}/workspace` |
| OPENCLAW_API_KEY | 1 | Internal API auth (hollywood-studio uses) |

### Telegram bots (per-tenant per AI_CORPORATION_BLUEPRINT.md — each tenant gets own bot, no shared @TAGAIWorkforceBot in multi-tenant mode)

| VAR | Count | Notes |
|---|---|---|
| TELEGRAM_BOT_TOKEN | 2 | Per-tenant bot |
| MICHELLE_MAYA_BOT_TOKEN | 1 | Michelle-tenant specific |
| MICHELLE_TELEGRAM_CHAT_ID | 1 | Michelle-tenant chat |
| WATCHDOG_TG_CHAT_ID | 1 | Per-tenant ops channel |

### Webhook secrets (per-service auth — distinct per tenant endpoint)

| VAR | Count | Notes |
|---|---|---|
| WEBHOOK_AUTH_TOKEN | 1 | michelle-fb webhook |
| WEBHOOK_SECRET | 1 | tour-book webhook |

### Tenant business config (these vary by customer, not by service)

| VAR | Count | Notes |
|---|---|---|
| ALLOWED_SENDERS | 1 | tour-book inbox allowlist (per Michelle/per tour-book tenant) |
| DELIVERY_EMAILS | 1 | tour-book delivery list |
| SHOWINGS_EMAIL | 1 | tour-book agent email |

### Phone numbers (per-tenant DIDs)

| VAR | Count | Notes |
|---|---|---|
| TELNYX_PHONE_NUMBER | 2 | Per-tenant outbound DID |
| SIP_OUTBOUND_NUMBER | 1 | Per-tenant outbound (hybrid-ai-tm) |
| TWILIO_FROM_NUMBER | 1 | Per-tenant Twilio number (if used) |
| LIVEKIT_OUTBOUND_ROOM_PREFIX | 1 | `tenant-{{TENANT_ID}}-outbound-` |

### Claude Code session tokens (per-user/operator, not shared)

| VAR | Count | Notes |
|---|---|---|
| CLAUDE_AI_SESSION_KEY | 1 | Per-user Claude Code session |
| CLAUDE_WEB_SESSION_KEY | 1 | Per-user Claude Web session |
| CLAUDE_WEB_COOKIE | 1 | Per-user Claude Web cookie |

---

## Category 3 — HOST / RUNTIME  (~6 vars, kept in `~/openclaw/.env` per-host)

Not secrets. Behavior toggles. Stay where they are.

| VAR | Count | Notes |
|---|---|---|
| OPENCLAW_IMAGE | 1 | Image tag, host-pinned default; per-tenant override possible |
| OPENCLAW_GATEWAY_BIND | 1 | `lan` or `0.0.0.0`; host policy |
| OPENCLAW_TZ | 1 | Host timezone |
| OPENCLAW_ALLOW_INSECURE_PRIVATE_WS | 1 | Security flag (off in prod) |
| ENV_VERSION | 1 | Config schema version marker |
| PORT | 1 | Service-internal default |
| XDG_CONFIG_HOME | 1 | XDG base dir |
| GOG_KEYRING_PASSWORD | 2 | Gnome keyring (system-level, irrelevant for tenants) |

---

## Decision points needing your call

These I classified to a default but flagging for your review:

| VAR | Default | Alternative | Why ambiguous |
|---|---|---|---|
| `LIVEKIT_API_KEY/SECRET` | SHARED | per-tenant | LiveKit Cloud has project-level quotas. If 100 tenants share one project, one tenant's call volume affects all. Per-tenant LiveKit projects = isolated quotas but more billing complexity. |
| `RESEND_API_KEY` | SHARED | per-tenant | Same reasoning as LiveKit. Per-tenant Resend = isolated reputation + per-tenant deliverability. |
| `TELNYX_PHONE_NUMBER` | PER-TENANT | shared pool | If you pool numbers across tenants, calls become anonymous. Per-tenant DIDs = caller-ID identity. |
| `ANTHROPIC/OPENAI/DEEPSEEK_API_KEY` | SHARED | per-tenant | Per-tenant LLM keys = isolated billing + quota. Shared = simpler ops, single bill. Recommend shared today, add `{{TENANT_<NAME>_KEY}}` override fallback in template now so we can flip later without rewrite. |
| `SUPABASE_*` | SHARED | per-tenant projects | One shared project + RLS per tenant_id row = simpler. Per-tenant Supabase projects = perfect isolation but 100x project mgmt. Conservative recommendation: shared. |

---

## Proposed migration plan (executed only after your approval)

1. **Snapshot:** Tar+gz all 16 current env files to `/home/tagai/env-backup-$(date +%Y%m%d-%H%M%S).tar.gz`, mode 600.
2. **Create** `/home/tagai/.openclaw-shared.env` (mode 600, owner tagai) with all SHARED vars + their current values. Source values from `.tagai-env` first (canonical) → fallback to any consumer file. If conflicting values across files for the same var: HALT and surface the conflict.
3. **Rewrite consumer .env files:** for each per-service .env, REPLACE inline shared-var lines with `# moved to /home/tagai/.openclaw-shared.env` comments. Keep only that service's PER-TENANT vars + HOST vars.
4. **Wire services to read both:** add `set -a; source /home/tagai/.openclaw-shared.env; set +a` at the top of any non-docker invocations. For docker-compose, add `env_file: [/home/tagai/.openclaw-shared.env, ./.env]` to the relevant compose entries.
5. **Restart services in order:** voiceai-server (PM2), jarvis-vapi-webhook (systemd), openclaw-gateway (docker), tour-book + michelle-cma containers. Verify each healthcheck after restart.
6. **Verify:** re-scan all env files, confirm zero duplicates of shared vars in service files.

---

## Questions before I execute (please review the table above and answer)

1. **Approve the SHARED list as-is?** Any vars to move from SHARED → PER-TENANT or vice versa?
2. **On the ambiguous calls:** stick with my defaults (shared LLM keys, shared LiveKit, shared Resend, per-tenant phone numbers), or flip any?
3. **Conflict resolution:** if `.tagai-env` and another file have different values for the same shared var, do I pick `.tagai-env` (canonical) and surface the conflict, or halt for manual review?
4. **Order of operations:** do this before or after Task #11 (PAT rotation) is fully verified? My recommendation: complete #11 first (you re-add SSH key, I run fetches, confirm), then do shared.env. Both are independent but #11 is closer to done.
