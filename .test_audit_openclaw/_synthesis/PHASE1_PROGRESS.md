# Jarvis Concierge — Phase 1 Progress Log

_Tracks each Phase 1 unlock as it gets completed on the live tagai-cloud Hetzner instance. Read by the May 25 audit routine to verify progress without depending on private server state. Append-only — newest entry on top._

---

## Baseline (set 2026-04-27)

Live instance: OpenClaw v2026.4.25 on tagai-cloud (Hetzner CPX21, 87.99.148.242).

**Re-prioritized top-6 unlocks (per `SURPRISES.md`):**
1. Standing Orders → live AGENTS.md (`/home/tagai/.openclaw/workspace/AGENTS.md`)
2. `openclaw mcp serve` registered in Claude Code settings
3. Skill enablement sweep on 48 idle skills (start: Tavily, Notion, Gmail, GitHub, Calendar)
4. Wire BlueBubbles + WhatsApp channels (BlueBubbles half-configured already)
5. Stand up 4 pending MCP servers (Vercel, GitHub, Supabase, M365)
6. Migrate one workflow to a `.lobster` typed pipeline (suggest: spectrum-send)

**Pre-existing on baseline (already done before plan was written):**
- Telegram channel wired (`@tagai_jarvis_bot`)
- DeepSeek-V4-Flash cost routing (95.4% cache hit, $2.40 spent)
- Hardened security: Token gateway auth + Allowlist exec + Device auth + paired devices
- 1 cron: `morning-digest` (0 7 * * * America/Chicago → Telegram chat 8603473262)
- `systemPromptOverride` in openclaw.json with full Jarvis Iron Man / Wolf of Wall Street persona
- Maya VAPI bridge live (assistant 291d9858-9dd5-421f-bd17-ba4bba25a168, phone 817-518-1584)
- VAPI MCP server registered (`jarvis-vapi`)
- 6 LLM providers wired (Anthropic, OpenAI, Google, DeepSeek, Mistral, Groq-audio)
- 57 skills installed (9 Ready / 48 Needs Setup)

---

## Unlock log

### [shipped] #1 — Standing Orders → AGENTS.md
- **Status:** SHIPPED 2026-04-27 ~13:43 CDT
- **Path:** `/home/tagai/.openclaw/workspace/AGENTS.md`
- **Source:** 6 Program blocks from `_synthesis/ACTIONS.md`, assembled into `_synthesis/standing-orders-payload.md`
- **Backup:** `/home/tagai/.openclaw/workspace/AGENTS.md.bak.1777315383` (md5 `5cf56cbc86bfe84927a8efb560cd6819`, 218 lines, original Apr 25 16:50)
- **Result:** AGENTS.md grew 218 → 355 lines. All 6 Program headers verified at lines 227, 239, 259, 280, 300, 330.
- **Runtime pickup:** AGENTS.md is auto-loaded on every session start (per the file's own "Session Startup" section). No restart needed; next inbound Telegram / web-chat prompt instantiates a session with the new rules in scope.
- **Verification owed (owner action):** Send Telegram message "What are your standing orders?" and confirm Jarvis recites Programs 1–6. Then ask "Use Opus to write a 5-sentence summary" — Jarvis should refuse / escalate per Program: Model Cost Routing.

### [shipped] #2 — `openclaw mcp serve` registered in Claude Code settings
- **Status:** SHIPPED 2026-04-27 ~14:10 CDT
- **Bridge:** local stdio MCP bridge (`openclaw mcp serve`) → `wss://openclaw.ubntag.com` (Caddy → gateway port 18789)
- **Token:** `C:/Users/gsanc/.openclaw/gateway.token` (64 chars, trimmed, user-scoped perms)
- **Device pairing:** approved as device `06fcc6d4cc12cfaf8ff66236cf395b8034f912006c6277f3a3969e6131085b19` from IP 47.161.120.20 with scopes `operator.read`, `operator.write`, `operator.approvals`
- **MCP config location:** `C:/Users/gsanc/TAG-Projects-2026/openclaw/.claude/settings.json` under `mcpServers.openclaw`
- **Tools exposed (9):** `conversations_list`, `conversation_get`, `messages_read`, `attachments_fetch`, `events_poll`, `events_wait`, `messages_send`, `permissions_list_open`, `permissions_respond`
- **Verification:** `conversations_list` returned the live `agent:main:main` session (Gus Sanchez Telegram chat 8603473262, lastMessage `HEARTBEAT_OK`).
- **Runtime pickup:** Claude Code reads `mcpServers` on session start. **Current session does NOT have access**; restart Claude Code in this directory to activate.

### [partial] #3 — Skill enablement sweep
- **Status:** Tavily + GitHub SHIPPED 2026-04-27. 3 starters remain.

- **GitHub details (shipped ~15:30 CDT):**
  - Wired as a saved MCP server entry in `openclaw.json` (NOT a plugin or skill — it's the official remote MCP at `https://api.githubcopilot.com/mcp/`)
  - Transport: `streamable-http` with `Authorization: Bearer <PAT>` header
  - PAT stored: local `C:/Users/gsanc/.openclaw/skills/github.token` + server `/home/tagai/.openclaw/secrets/github.token` (chmod 600)
  - PAT type: fine-grained (`github_pat_11A...`), authenticated as GusAI40 / DataWiseGus, 20 public repos
  - Direct MCP `initialize` handshake against `api.githubcopilot.com/mcp/` returned protocolVersion 2025-06-18 with tools/prompts/resources/completions caps. PAT auth resolves the "OAuth uncertainty" flagged in `project_openclaw_pending_work.md` Tier 1 #4 — Path A works.
  - Saved-MCP list inside container shows `github` and `jarvis-vapi`
  - **Security action owed:** PAT was pasted in chat — rotate at https://github.com/settings/tokens after testing settles


- **Tavily details:**
  - Bundled first-party plugin (NOT a community skill — official integration per https://docs.tavily.com/documentation/integrations/openclaw)
  - API key (dev tier, `tvly-dev-...`) stored in `/home/tagai/openclaw/.env` as `TAVILY_API_KEY` and inline in `/home/tagai/.openclaw/openclaw.json` under `plugins.entries.tavily.config.webSearch.apiKey`
  - openclaw.json updates: `plugins.entries.tavily.enabled=true`, `tools.web.search.provider="tavily"`
  - Backup of openclaw.json saved with unix-timestamp suffix
  - Tools exposed: `tavily_search`, `tavily_extract`. Capability advertised: `web-search: tavily`
  - Verified end-to-end: direct Tavily API smoke test returned 3 live results
  - **Security action owed:** key was pasted in chat — rotate at https://app.tavily.com after testing settles
- **Notion:** SKIPPED 2026-04-27 (owner doesn't use Notion)

- **Supabase details (shipped ~15:55 CDT):**
  - Wired as saved MCP server in `openclaw.json` using official `@supabase/mcp-server-supabase@latest` (npx stdio)
  - Token: `SUPABASE_ACCESS_TOKEN` (sbp_...) inlined in openclaw.json + pushed to server `.env` (was empty placeholder before)
  - Source of token: local `/c/Users/gsanc/.env` (already on disk, not newly leaked)
  - Smoke test returned 28 tools incl. `execute_sql`, `apply_migration`, `deploy_edge_function`, `list_tables`, `get_advisors`, `get_logs`
  - Verified PAT visibility: 5 projects (HUM, E-Rate Pipeline 2026, spectrum-aitify-production, Lead Machine Auto-Pilot ref `bjhjqegqfieyekbffgij`, dacp-pursuit-intelligence)
  - Container force-recreated to pick up env_file change (~30s outage)

- **Microsoft Graph details (shipped ~15:50 CDT):**
  - Pre-existing custom MCP stdio server at `/home/node/.openclaw/mcp-servers/microsoft-graph/src/index.mjs` (built but not yet wired into config — solved bench-blocker "Email integration — blocked on Microsoft Graph")
  - 6 tools: `mail_search`, `mail_send`, `calendar_list_events`, `calendar_create_event`, `drive_list`, `drive_get_file`
  - Auth: client-credentials (app-only) using `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_DEFAULT_USER` (all from `/c/Users/gsanc/.env` AZURE_* renamed to MS_*; container env confirmed all populated)
  - Wired as saved MCP server in `openclaw.json` with creds inlined in env block
  - Smoke test: stdio server initialized, returned all 6 tools with full schemas

- **Vercel details (shipped 2026-04-27 ~17:55 CDT):**
  - Wired as saved MCP server in `openclaw.json` at `mcp.servers.vercel` (Vercel's official MCP at `https://mcp.vercel.com/`)
  - Transport: `streamable-http` with `Authorization: Bearer <token>` header
  - Token: CLI bearer (`Tc99ru0aNj6BAGu4BQbxNev3`), source = `C:/Users/gsanc/AppData/Roaming/com.vercel.cli/Data/auth.json`. Saved to server `/home/tagai/.openclaw/secrets/vercel.token` (chmod 600) + inlined in openclaw.json
  - Direct MCP `initialize` against `mcp.vercel.com` returned protocolVersion 2025-06-18, server "Vercel MCP Server v2", caps `tools.listChanged` + `prompts.listChanged`
  - Backup of openclaw.json saved at `/home/tagai/.openclaw/openclaw.json.bak.1777330406`
  - Container force-recreated (~30s outage) to attach new MCP connection; gateway came up healthy in ~26s, 6 plugins loaded
  - Smoke test (synthetic agent turn, deepseek-v4-flash, no delivery): `vercel__list_teams` succeeded with 1 call / 0 failures, returned 2 teams — `GOAT-UIX` (`team_A9mO9nXfBvnPN57ZJc2zxoG5`) and `TAG-ai` (`team_hLW8yrUTYNGt9CiRY4IMMSet`)
  - Tools surface (8): `list_teams`, `list_projects`, `get_project`, `deploy_to_vercel`, `search_vercel_documentation`, `web_fetch_vercel_url`, `list_toolbar_threads`, `reply_to_toolbar_thread`
  - **Side-finding flagged for separate fix:** runtime warned AGENTS.md was truncated 35% before injection (15458 → 9999 chars). Programs added 2026-04-27 morning may be partially clipped. Tune `agents.defaults.bootstrapMaxChars` / `bootstrapTotalMaxChars`.
  - **Security note:** token has been in chat transcripts since 2026-04-25 (originally extracted into `project_openclaw_pending_work.md`). Owner can rotate at https://vercel.com/account/tokens if desired; not a fresh leak.

- **Remaining starters (lower priority):** Gmail (personal — covered by MS Graph for business), Calendar (same), Resend, Salesforce
