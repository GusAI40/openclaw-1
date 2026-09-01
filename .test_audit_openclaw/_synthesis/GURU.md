# OpenClaw — Guru Brief & Gap Analysis

_For Gus — TAG-Projects-2026 / openclaw (formerly OpenClaw, branded as Jarvis AI internally)_  
_Live instance: v2026.4.25 on Hetzner_  
_Generated: 2026-04-27_

---

## TL;DR (read first)

You're running OpenClaw at roughly **15–20% of its documented capability surface.** Telegram is wired, one agent (`main`) is alive, deepseek-v4-flash is doing 99.9% of inference at 95.4% cache hit, security is hardened, and a single `morning-digest` cron is firing. **48 of 57 installed skills are stuck in "Needs Setup."** The five highest-leverage unlocks for *your specific* Jarvis/Maya/Michelle/Spectrum stack are listed at the bottom — ranked by ROI per hour of setup.

---

## What you have wired today (Current State — condensed from 25 live screenshots)

| Domain | What's on |
|--------|-----------|
| **Channels** | Telegram only (polling, last probe "just now"). BlueBubbles authored in settings but no accounts/allowlist. |
| **Agents** | One agent: `main`, profile "Team Bot", model `default`, thinking Off. Workspace `/home/node/.openclaw/workspace` with all 7 file slots populated (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, MEMORY). |
| **Inference** | 71M of 71.1M tokens this window via `deepseek-v4-flash`. $2.40 / 798 messages. **95.4% cache hit.** `gemini-2.5-flash-lite` and `claude-sonnet-4.6` reachable but unused. |
| **Skills** | 57 installed total — **only 9 Ready, 48 Needs Setup.** ClawHub VirusTotal-scanned automatically (free, no opt-in). |
| **Cron** | One job: `morning-digest`, `0 7 * * *` America/Chicago, posts to Telegram chat `8603473262`. |
| **Security** | Token gateway auth, Allowlist exec policy, Device auth ON, Exec-approvals: Deny default / Ask on miss / Fallback Deny. Two paired operator devices, one with `operator.talk.secrets` scope. |
| **MCP** | 1 server configured — identity not visible in screenshots (you've previously noted Vercel/GitHub/Supabase/M365 are pending). |
| **Dreaming** | OFF. |
| **Voice** | Not wired. Maya/LiveKit lives in a separate stack today. |

---

## What OpenClaw can do (Future State — guru surface)

OpenClaw is a TypeScript "personal AI assistant" platform — github.com/openclaw/openclaw, **365K stars, 75K forks, MIT, last pushed today.** Founder: Peter. The official tagline is **"Your assistant. Your machine. Your rules."** Karpathy publicly endorsed it. It rebranded twice (Clawd → Moltbot → OpenClaw, Jan 29 2026) and has shipped 469 markdown docs pages mapped across 14 languages.

The full capability surface, organized:

### 1. Channels (24+ adapters available, you have 1)
WhatsApp · Telegram · Discord · Slack · Microsoft Teams · iMessage (BlueBubbles bridge) · Signal · IRC · Feishu · Google Chat · LINE · Nostr · Twitch · Zalo · Element/Matrix · Web Chat · Email · SMS (Telnyx/Twilio) · Voice (LiveKit) · Groups · Channel-routing layer

### 2. LLM providers (~17 — you use 1)
Anthropic Claude (incl. Claude-Max-API-Proxy) · OpenAI · Gemini · Groq · DeepSeek · Moonshot/KIMI K2.5 · Xiaomi MiMo-V2-Flash · Qwen · MiniMax · Ollama (local) · LM Studio (local) · OpenRouter · LiteLLM · Kilocode · Opencode · GitHub Copilot · Vydra · Fal · Runway · sglang

### 3. Built-in tools (~20)
Web fetch · **Browser control** · Skills · DuckDuckGo · Exa · Perplexity · Gemini · Minimax · Brave · Agent-send (multi-agent message) · Loop detection · Code execution · Exec / exec-approvals · Elevated tools · PDF · Image generation · Media overview · Thinking · Lobster · Reactions

### 4. Memory & context subsystem
Memory-search · Memory-honcho (persistent recall) · Memory-qmd (queryable memory directives) · Compaction · Sessions · Context-engine · Queue · Messages · Presence · Models config

### 5. Multi-agent runtime
Multi-agent delegation · Agent workspace · Delegate-architecture · Per-agent file slots: AGENTS / SOUL / IDENTITY / BOOT / USER / TOOLS / HEARTBEAT / MEMORY · Templates: AGENTS.dev, AGENTS.default

### 6. Gateway (server)
Health · Heartbeat · Discovery · Network model · OpenAI HTTP API · OpenResponses HTTP API · Tools-invoke HTTP API · Protocol · Security · Secrets-plan-contract · Sandboxing · Trusted-proxy-auth · CLI backends · **Bonjour LAN discovery** · Logging · Configuration reference

### 7. Plugins
Plugin architecture · SDK entrypoints · SDK subpaths · SDK testing · Community plugins (Zalouser etc.)

### 8. Automation primitives
**Standing orders** (declarative rules — "always do X when Y") · **Taskflow** (multi-step workflows) · **Cron jobs** (you have 1) · **Tasks** (one-off scheduled actions)

### 9. Nodes (presence + voice)
Node concept · **Voicewake nodes** (speaker-detector wake-word) · Image nodes

### 10. CLI surface (~20 verbs)
setup · cron · message · skills · hooks · webhooks · acp · approvals · voicecall · sandbox · security · status · config · update · uninstall · qr · infer · nodes · flows

### 11. Security stack
Threat model (CONTRIBUTING-THREAT-MODEL) · Formal verification ("machine-checkable security models") · 34 hardening commits at rebrand · Token gateway auth · Allowlist exec · Device auth + paired devices with revocable scopes · Secret reference / credential surface · ClawHub VT scanning · Code Insight (Gemini-LLM behavioral analysis of every published skill) · Daily re-scans + auto-block

### 12. Platforms
macOS (permissions, icon, voicewake, canvas, menu-bar, peekaboo, signing, logging, remote) · iOS · Linux/VPS · Hetzner (you) · Hostinger · Railway · Fly · Kubernetes · Docker (`--read-only --cap-drop=ALL` is the recommended hardening) · Bun runtime

### 13. Marketplace (ClawHub)
Skill bundles · VirusTotal scanning · Code Insight scan badges · Daily re-scan · Auto-block

### 14. Dreaming subsystem
Background reflection / autonomous improvement loop. **Currently OFF** on your instance.

---

## The Gap — ranked by ROI for *your* TAG/Jarvis/Maya/Michelle/Spectrum stack

### #1 — Wire the channels you've already authored (~30 min, **HIGH ROI**)
**Why:** BlueBubbles is half-configured (channel exists in Communications panel, 0 accounts attached). WhatsApp is documented as a first-class channel and is where a lot of Michelle's seller/client comms happen. Adding either one routes high-signal conversations into Jarvis without you rebuilding workflow infra.  
**Concrete steps:**
1. Finish BlueBubbles: link the BlueBubbles Mac app's REST endpoint, fill Accounts + Allow-From in `Communications → Channels → BlueBubbles`.
2. Add WhatsApp channel via `docs.openclaw.ai/channels/whatsapp` — this is where 24+ channels live.
3. Set up channel-routing so different channels target different agents (e.g., `michelle-agent` for iMessage/WhatsApp luxury comms, `tag-agent` for Telegram ops).

### #2 — Verify & turn on the memory subsystem (Honcho/QMD) (~1–2 hr, **FOUNDATIONAL**)
**Why:** Sid's 101 article puts persistent memory at step 5 of the canonical happy path. Your current-state screenshots don't confirm it's wired. Without it, every `main` agent session starts cold on context — every cross-session recall degrades to whatever's in MEMORY.md (a single file). With Honcho on, your morning-digest cron, Maya conversations, and Spectrum touches all share continuity.  
**Concrete steps:**
1. Read `docs/concepts/memory-honcho.md` (already on disk at `02-github-docs/source/concepts/memory-honcho.md`).
2. Read `docs/concepts/memory-qmd.md` and `docs/concepts/memory-search.md`.
3. Enable + configure the Honcho store; verify it logs on cron-job runs.

### #3 — Stand up the 4 pending MCP servers (~half day, **PRODUCTIVITY MULTIPLIER**)
**Why:** Your `project_openclaw_pending_work.md` already names them: **Vercel · GitHub · Supabase · M365**. You're a heavy user of all four. Once attached, the `main` agent (or per-domain sub-agents) can deploy, commit, query DB, and read email *from inside Telegram*, eliminating context switches.  
**Concrete steps:**
1. Use `docs/plugins/architecture.md` and `docs/plugins/sdk-entrypoints.md` as the contract.
2. Wire MCP servers one-at-a-time; verify in CONTROL → AI & Agents.
3. Update agent SOUL.md to grant tool access selectively (preserve your hardened security posture).

### #4 — Skill enablement sweep + ClawHub triage (~1–2 hr, **QUICK WIN**)
**Why:** 48 of 57 skills are stuck in "Needs Setup." Sid's 101 names **Tavily search · Notion · Gmail** as the must-have starter set. Several of those are likely in your idle 48. Finishing setup on the right 8–10 turns dormant skills into live tools without installing anything new. ClawHub already auto-VT-scans new installs (free safety net).  
**Concrete steps:**
1. Open Skills page, filter to "Needs Setup."
2. Pick: **Tavily search, Notion, Gmail, GitHub, Calendar, Slack** (matches your TAG ecosystem).
3. Fill credentials (use the secret-reference / credential-surface system — never paste keys into chat).
4. Verify each shows green Ready badge.

### #5 — Turn on Standing Orders for the rules you currently enforce manually (~1 hr, **PROCESS COMPRESSION**)
**Why:** You repeatedly enforce rules across sessions ("never use Opus by default — use DeepSeek-V4-Flash", "verify Supabase logging before any FB campaign", "before deploy check git remote auth + env vars + token freshness"). Today these live in CLAUDE.md and memory files. **Standing orders** make them runtime-enforced inside OpenClaw itself — every agent run, every channel hit, every tool invocation respects them.  
**Concrete steps:**
1. Read `docs/automation/standing-orders.md`.
2. Translate the top 5 from your CLAUDE.md / memory rules into standing orders (cost-routing, deploy-preflight, scope-discipline).
3. Verify they fire (debug → test the trigger).

---

## Free wins (already protecting you, no action needed)

- **VirusTotal + Code Insight scanning** is automatic for every ClawHub skill you install — SHA-256 lookup + Gemini-LLM behavioral analysis + daily re-scans + auto-block. The Feb 7 partnership pre-dated the "ClawHavoc" attack referenced in Sid's 101 — the OpenClaw team got ahead of it.
- **Your security posture is already top-decile**: Token gateway auth + Allowlist exec + Device auth + paired-device scopes is the recommended config from `docs/security/CONTRIBUTING-THREAT-MODEL.md`.
- **DeepSeek-V4-Flash routing at 95.4% cache hit is excellent.** Cost discipline is locked.

---

## Strategic adjacencies (longer-term, lower priority)

- **Voice/LiveKit nodes** — your TAG-VoiceAI / Maya stack today is separate. OpenClaw natively supports voice channels and Voicewake nodes. A future merge could fold Maya into the same agent mesh.
- **Multi-agent delegation** — once MCP servers + memory are on, splitting `main` into `jarvis`, `maya`, `michelle`, `spectrum` sub-agents (per-domain SOUL.md/IDENTITY.md) becomes natural. Delegate-architecture docs cover this pattern.
- **Dreaming subsystem** — currently OFF. Worth revisiting *after* you've stabilized #1–#5 above. Auto-research-style background optimization could surface workflow improvements you'd otherwise miss.
- **Browser control tool** — unlocks Salesforce/MLS auto-fill that today requires Playwright skills. Replaces several brittle automations.
- **Self-hosted local LLM** (Ollama / LM Studio) — for sensitive Michelle/Spectrum data, you could route specific channels through a local model while keeping cloud DeepSeek for everything else.

---

## Source artifacts on disk

- `_current_state/` — 25 live-UI screenshots (your instance v2026.4.25)
- `_current_state/CURRENT_STATE.md` (also at `_synthesis/CURRENT_STATE.md`) — full inventory
- `01-docs-openclaw-ai/` — 30 docs page screenshots + URL list (162 English canonical paths)
- `02-github-docs/source/` — **469 markdown + 32 config files**, full mirror of github.com/openclaw/openclaw/docs
- `03-substack-101/` — Sid Saladi's 101 article (paywalled mid-content) + ANALYSIS.md
- `04-virustotal-partnership/` — VirusTotal post + Introducing post + homepage + blog index + ANALYSIS.md
- `_synthesis/CURRENT_STATE.md` — what you have today
- `_synthesis/GURU.md` — this file

## Provenance / honesty notes

- I could not access the paywalled portion of Sid Saladi's Substack 101. The visible portion confirms steps 1–7 of the happy path; steps 8+ are gated.
- The `openclaw.ai/blog` index is a JS-rendered SPA — there are currently only **2 blog posts total** (Introducing OpenClaw + VirusTotal partnership). Blog history is short.
- The four parallel crawler subagents I launched first all hit a tool sandbox (no Bash/WebFetch/Firecrawl). The crawl was redone from main context; the GitHub mirror is exhaustive (469 files), the docs.openclaw.ai content is fully covered by that mirror (Mintlify builds docs.openclaw.ai from this exact folder), so docs analysis is high-fidelity.
- Screenshot count for visual record: **30 docs pages + 1 substack full-page + 3 marketing pages = 34 new** (plus your 25 existing live-UI screenshots in `_current_state/`).
