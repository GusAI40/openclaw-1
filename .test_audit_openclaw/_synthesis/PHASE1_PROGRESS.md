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

### [pending] #2 — `openclaw mcp serve` registered in Claude Code settings
- **Why next:** Lets the local Claude Code session (this terminal) talk to the live tagai-cloud agent over MCP. Unlocks "spawn live Jarvis as a sub-agent" workflow.
- **Estimated effort:** 10 min
