# OpenClaw — High-Impact Surprises (supplement to GURU.md)

_Late discoveries from the deep docs analyst (469 markdown files read). These are findings the original GURU.md under-weighted because I shipped before the analyst returned. Each one materially changes a recommendation for **your** stack._

---

## 1. ACP harnesses — run Claude Code AS a sub-agent of OpenClaw

**The discovery:** OpenClaw ships native ACP (Agent-Client-Protocol) harnesses for **claude · codex · copilot · cursor · droid · gemini · iflow · kilocode · kimi · kiro · opencode · openclaw · pi · qwen** (`tools/acp-agents.md`). Spawn pattern:

```js
sessions_spawn({
  runtime: "acp",
  agentId: "claude",     // or "codex", "gemini", etc.
  thread: "auto",
  mode: "persistent",    // or "oneshot"
  cwd: "/path/to/repo",
  resumeSessionId: "...",
  streamTo: "parent"
})
```

**Why this matters for you:** You have Claude Code Pro Max. You also have Codex (you're already using it for cross-model review per your `kb_codex_adversarial_review_in_claude_code.md` rule). Today these run in separate windows. Inside OpenClaw, your Telegram-bound `main` agent can `sessions_spawn` Claude Code OR Codex as a sub-agent on demand — and you can wire it so a Discord channel binds to native Codex while a Telegram channel binds to Claude. Same gateway, same memory, same standing orders.

**Concrete unlock:** "Hey Jarvis, have Codex adversarially review the last 5 commits" becomes a one-message Telegram action that spawns a Codex ACP session in your repo, runs the review per your CLAUDE.md `kb_cross_model_review_eliminates_blind_spots.md` pattern, posts the diff back. **No more tab-switching.**

---

## 2. OpenAI HTTP API by default — your Gateway IS a model provider

**The discovery:** `gateway/openai-http-api.md` — every OpenClaw Gateway exposes `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/models` out of the box. Returns `openclaw/default` and `openclaw/<agentId>` as model IDs.

**Why this matters for you:** You have multiple things that take an OpenAI-style endpoint: any future Open WebUI install, LibreChat, your TAG-Pulse-Websites, RAG pipelines, Vercel AI Gateway, even custom Spectrum/E-Rate scripts. Today you'd point each at Anthropic/DeepSeek/etc. directly. **Pointing them all at your OpenClaw gateway** routes them through your `main` agent's full tool surface, memory, skills, and standing orders — and gives you one place to enforce cost routing.

**Concrete unlock:** Set `OPENAI_BASE_URL=http://hetzner:18789/v1` and `OPENAI_API_KEY=<your-gateway-token>` in any OpenAI-compatible app and it inherits your entire OpenClaw stack.

---

## 3. VoiceClaw real-time + Gemini Live = drop-in upgrade for Maya

**The discovery:** `/voiceclaw/realtime` is a WebSocket where Gemini Live (Google's real-time voice model) is the brain, OpenClaw exposes its full tool surface to it, and tool calls return immediate `working` results so voice latency stays low while tools run async. Combined with the bundled `voice-call` plugin (Plivo/Twilio) and macOS voice wake (`right-Option PTT` + always-on Speech).

**Why this matters for you:** Maya today is LiveKit + Telnyx + your VAPI stack. That works, but it's 3 systems. VoiceClaw collapses voice ingest + LLM brain + tool calls into ONE WebSocket. Plus the voice-call plugin gives you Plivo/Twilio out of the box (you're already on Telnyx; Twilio is your fallback). Your existing CMA / showing-request / comp-analysis VAPI tools could be exposed as OpenClaw tools and then called by voice via `/voiceclaw/realtime`.

**Concrete unlock (medium-term):** Port Maya from LiveKit+VAPI+ElevenLabs to OpenClaw VoiceClaw + voice-call plugin + ElevenLabs TTS provider. Same Michelle real-estate use case, fewer moving parts, all hosted on your existing Hetzner box.

---

## 4. Broadcast groups — multi-agent on one peer

**The discovery:** `channels/broadcast-groups.md` — experimental but live (WhatsApp first):

```yaml
broadcast:
  "<peer-id>": ["alfred", "baerbel", "code-reviewer"]
```

Runs N agents in **parallel or sequential** on the same peer, each with isolated session/tools/personality/model. Discord/Telegram/Slack planned.

**Why this matters for you:** Michelle's high-value clients (the seven-figure Coldwell Banker Global Luxury crowd) often have multi-faceted asks: "I want a CMA for 123 Main, plus three school-fit comparisons, plus a relocation guide for the family." Today that's 3 sequential skills. With broadcast groups, you wire `michelle-cma`, `michelle-schools`, `michelle-relocation` as separate sub-agents per WhatsApp peer — all three respond in parallel to the same client message, each with its own SOUL.md and tool set.

**Concrete unlock:** Run the same pattern across iMessage (BlueBubbles) once broadcast support lands there. Buyer-side / seller-side / market-update agents all replying simultaneously.

---

## 5. Lobster typed workflows — replace your shell scripts

**The discovery:** `tools/lobster.md` — `.lobster` YAML files are **resumable approval-gated typed workflows**. Each step has `stdin: $step.json`, `condition: $step.approved`, `approval: required`. A halt returns a `resumeToken`. Inline `llm-task` plugin gives schema-validated structured JSON output inside the deterministic flow.

**Why this matters for you:** Your project has many multi-step workflows that today run as Node scripts or skill orchestrators: Spectrum touch1/touch2/touch3 sends, Michelle 7-day FB rotation, listing onboarding, CMA generation, copper-send. Lobster turns each of these into a typed pipeline with **mandatory human approval gates** — exactly the human-approval-before-send pattern your CLAUDE.md already enforces ("Enforces human approval gate before send — non-negotiable").

**Concrete unlock:** Convert `spectrum-send` from a skill into a `.lobster` pipeline: enrich-contact → draft-email → llm-task validate-against-ICP → approval:required → send → log-to-supabase. Halts on approval gate, you approve via Telegram message, resumes automatically.

---

## 6. Memory Wiki plugin — Karpathy's pattern, built-in

**The discovery:** `plugins/memory-wiki.md` ships a **provenance-rich knowledge vault** with `wiki_search`, `wiki_get`, `wiki_apply`, `wiki_lint`. Compiles raw inputs into linked wiki pages.

**Why this matters for you:** This IS Karpathy's LLM-wiki pattern that you've been building manually in `TAG-YouTube-Transcripts`, `jarvis-spine`, `~/.claude/rules/archive/kb_*.md`. You're already a deep believer in this pattern (per your global CLAUDE.md and the 100+ kb_* memory files). OpenClaw ships it as a first-class plugin with hooks into the agent's memory subsystem.

**Concrete unlock:** Migrate your `kb_*.md` knowledge corpus into OpenClaw's Memory Wiki. Your `main` agent gains automatic wiki search/lint/apply on every turn. The wiki self-heals (lint mode finds gaps and proposes pages).

---

## 7. `openclaw mcp serve` — feed OpenClaw INTO Claude Code

**The discovery:** `openclaw mcp serve` exposes OpenClaw as an **MCP server**. Combined with the existing MCP-server bridge (other MCP servers feed INTO OpenClaw), this creates a bidirectional bridge.

**Why this matters for you:** Your daily driver is Claude Code (this conversation). Today Claude Code has access to its own MCP servers (Supabase, Playwright, Apollo, etc.). With `openclaw mcp serve`, Claude Code gets a new MCP server: your Hetzner OpenClaw instance. From inside Claude Code you can: query Jarvis's memory, send a Telegram message via OpenClaw, spawn a sub-agent on Hetzner, access Maya tools.

**Concrete unlock:** Add the Hetzner OpenClaw as an MCP server in your Claude Code settings.json. Inside Claude Code, you get one-shot tool calls into your full OpenClaw + Jarvis + Maya stack without leaving the IDE.

---

## Re-prioritized top 5 unlocks (replaces GURU.md ranking)

Folding these in, the actionable order changes:

| Old rank | New rank | Action | Time | Why |
|---|---|---|---|---|
| #5 | **#1** | Standing Orders (ACTIONS.md ready) | 30 min | Foundational — gates everything else |
| — | **#2** | `openclaw mcp serve` + add to Claude Code MCP | 30 min | Connects your IDE to your runtime — daily-use wins start immediately |
| #4 | **#3** | Skill enablement sweep (Tavily/Notion/Gmail/GitHub/Calendar) | 1-2 hr | Quick wins on installed-but-idle skills |
| #1 | **#4** | Wire BlueBubbles + WhatsApp channels | 30 min | Then bind to per-domain agents (Michelle on iMessage) |
| #3 | **#5** | Stand up the 4 pending MCP servers (Vercel/GitHub/Supabase/M365) | 1/2 day | Now scoped by Standing Orders for safety |
| (new) | **#6** | Migrate one workflow to a `.lobster` pipeline (suggest: spectrum-send) | 1-2 hr | Validates the typed-workflow pattern on a real revenue task |

The memory subsystem unlock (originally #2) drops in priority because **you already have the builtin SQLite + keyword/vector/hybrid backend running by default** — verifying the agent files (AGENTS/SOUL/MEMORY) are sane is the actual work, not adding Honcho. Add Honcho only when you start running multiple agents that need cross-agent recall.

---

## Things you can ignore (intentional non-actions)

- **Formal verification (TLA+/TLC models)** — interesting, not actionable. The formal models live at `vignesh07/openclaw-formal-models` and are evidence the security claims hold; not something you configure.
- **iOS / Android nodes** — useful but you don't currently have a use case (no field-camera workflows, no peekaboo screenshot needs).
- **Dreaming subsystem** — keep it OFF until #1–#5 land. The 6-weighted-signal promotion logic is sophisticated but adds complexity you don't need yet.
- **Multiple gateways** — single Hetzner gateway is the right architecture for your scale.

---

## Provenance

This SURPRISES.md is built from the docs analyst's late return (1.3M tokens of analysis, 360+ atomic capabilities catalogued). The full analyst output is preserved at `02-github-docs/ANALYSIS.md`. Cross-checked against your existing memory rules and pending work notes.
