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
- **Remaining 3 starters:** Notion, Gmail, Calendar (each needs owner-supplied credentials)
