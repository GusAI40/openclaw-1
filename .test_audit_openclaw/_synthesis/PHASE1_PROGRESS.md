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

### [pending] #1 — Standing Orders → AGENTS.md
- **Status:** in progress (started 2026-04-27)
- **Path:** `/home/tagai/.openclaw/workspace/AGENTS.md`
- **Source:** 6 Program blocks from `_synthesis/ACTIONS.md`
- **Backup convention:** `AGENTS.md.bak.<unix-timestamp>` before any append
