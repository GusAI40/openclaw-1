# OpenClaw Marketing-Surface Analysis (homepage + 2 blog posts)

_Sources on disk:_
- `homepage.md` (55KB) — full openclaw.ai homepage content
- `post.md` (8KB) — VirusTotal partnership announcement (Feb 7, 2026)
- `introducing-openclaw.md` (3KB) — rebrand + first-release post (Jan 29, 2026)
- `blog-index.md` (789B, SPA shell) — only **2 posts** total: introducing + virustotal

---

## A. The rebrand & origin (`introducing-openclaw.md`)

**Original quote:**  
> "Two months ago, I hacked together a weekend project. What started as 'WhatsApp Relay' now has over 100,000 GitHub stars and drew 2 million visitors in a single week."

**Naming history:** WhatsApp Relay → **Clawd** (Nov 2025; Anthropic legal asked to drop) → **Moltbot** (5am Discord brainstorm) → **OpenClaw** (final, trademarks cleared Jan 29, 2026).

**Founder:** Peter (signs the post). Mascot stays a lobster. 🦞

**The core proposition (verbatim):**  
> "OpenClaw is an open agent platform that runs on your machine and works from the chat apps you already use. WhatsApp, Telegram, Discord, Slack, Teams—wherever you are, your AI assistant follows. Your assistant. Your machine. Your rules."

**Shipped at rebrand:**
- New channels: **Twitch + Google Chat** plugins
- New models: **KIMI K2.5 + Xiaomi MiMo-V2-Flash**
- Web Chat: send images just like in messaging apps
- **34 security-related commits**, "machine-checkable security models" released that week

**Direction stated:** Security is the #1 priority. Then gateway reliability. Then more models/providers.

---

## B. VirusTotal partnership (`post.md`, Feb 7, 2026)

**What it announces:** Every skill published to ClawHub (the OpenClaw skill marketplace) is now scanned by VirusTotal automatically — **no API key, no opt-in, marketplace-side, runtime gets it free on next ClawHub touch.**

**Three concrete capabilities:**
1. **SHA-256 hash + VT database lookup** of every published skill bundle
2. **Code Insight** — Gemini-powered LLM behavioral analysis of `SKILL.md` + scripts; flags exfiltration, external-code execution, prompt-injection coercion
3. **Daily re-scans + auto-block** of malicious skills + public scan badges on every skill page

**Critical context:** VT post (Feb 7) **predates** the "ClawHavoc" attack referenced in the Substack 101 (March 29). Partnership was **pre-emptive**, not reactive.

**Implication for user:** This is automatic — your existing 57 skills already benefit from VT scans on the marketplace side. No setup needed.

---

## C. Homepage feature surface (`homepage.md`)

**Hero proposition (top of page):**  
"Your assistant. Your machine. Your rules." — runs locally, works through the chat apps you already use.

**Top 6 feature blocks (verbatim H2/H3 from homepage):**
1. **Runs on Your Machine** — privacy/local-first, your infrastructure, your keys, your data
2. **Any Chat App** — 24+ channels supported (Telegram, WhatsApp, Discord, Slack, Teams, iMessage/BlueBubbles, Signal, IRC, Feishu, Google Chat, LINE, Nostr, Twitch, Zalo, Element/Matrix, etc.)
3. **Persistent Memory** — long-term recall across sessions
4. **Browser Control** — agent can drive a browser
5. **Full System Access** — run sandboxed (Docker `--read-only --cap-drop=ALL`) or full
6. **Skills & Plugins** — extensibility surface

**Trust signal:** Karpathy quote on homepage: *"Excellent reading thank you. Love oracle and Claw."*

**Stats touted:** 100K+ GitHub stars (now 365K per API), 2M visitors in a single week.

---

## D. Consolidated public-marketing capability surface (~150 items)

Atomic features advertised across all 3 public-marketing sources, deduplicated:

### Channels (24+)
WhatsApp · Telegram · Discord · Slack · Microsoft Teams · iMessage (via BlueBubbles) · Signal · IRC · Feishu · Google Chat · LINE · Nostr · Twitch · Zalo · Element/Matrix · Web Chat · Email · SMS (via Telnyx/Twilio) · Voice (LiveKit) · IRC · Groups · Channel-routing layer · Channel-troubleshooting tooling

### Providers (LLM)
Anthropic Claude (incl. Claude-Max-API-Proxy) · OpenAI · Google Gemini · Groq · DeepSeek · Moonshot/KIMI K2.5 · Xiaomi MiMo-V2-Flash · Qwen · MiniMax · Ollama (local) · LM Studio (local) · OpenRouter · LiteLLM · Kilocode · Opencode · GitHub Copilot · Vydra · Fal · Runway · sglang · Google direct

### Tools (built-in)
Web fetch · Browser control · Skills (incl. creating-skills) · DuckDuckGo search · Exa search · Perplexity search · Gemini search · Minimax search · Brave search · Agent-send (multi-agent message) · Loop detection · Code execution · Exec / exec-approvals · Elevated tools · PDF · Image generation · Media overview · Thinking · Lobster (mascot tool) · Reactions

### Concepts / runtime
Multi-agent delegation · Agent workspace · Sessions · Context engine · Memory search · Memory-honcho · Memory-qmd · Compaction · Models config · Features · Presence · Queue · Messages · Architecture · Delegate-architecture

### Gateway
Health · Heartbeat · Discovery · Network model · OpenAI HTTP API · OpenResponses HTTP API · Tools-invoke HTTP API · Protocol · Security · Secrets-plan-contract · Sandboxing · Trusted-proxy-auth · CLI backends · Bonjour (LAN discovery) · Logging · Configuration reference

### Plugins
Plugin architecture · SDK entrypoints · SDK subpaths · SDK testing · Community plugins · Zalouser plugin

### Automation
Standing orders · Taskflow · Cron jobs · Tasks

### Nodes
Node concept · Voicewake · Image nodes

### CLI
setup · cron · message · skills · hooks · webhooks · acp · approvals · voicecall · sandbox · security · status · config · update · uninstall · qr · infer · nodes · flows

### Reference templates (the "agent files")
AGENTS · SOUL · IDENTITY · BOOT · USER · HEARTBEAT · MEMORY · AGENTS.dev · AGENTS.default

### Security
Threat model (CONTRIBUTING-THREAT-MODEL) · Formal verification · Machine-checkable security models · 34 hardening commits at rebrand · Token gateway auth · Allowlist exec policy · Device auth · Secret reference / credential surface · ClawHub VirusTotal scanning · Code Insight LLM analysis

### Platforms
macOS (permissions, icon, voicewake, canvas, menu-bar, peekaboo, signing, logging, remote) · iOS · Linux/VPS · Hetzner · Hostinger · Railway · Fly · Kubernetes · Docker (read-only + cap-drop hardening) · Bun runtime · macOS-VM · exe-dev

### Marketplace
ClawHub (skill marketplace) · VirusTotal scanning · Code Insight badges · Daily re-scans · Auto-block of malicious skills

### Memory templates (per-agent on-disk slot)
AGENTS.md · SOUL.md · IDENTITY.md · BOOT.md · USER.md · TOOLS.md · HEARTBEAT.md · MEMORY.md
