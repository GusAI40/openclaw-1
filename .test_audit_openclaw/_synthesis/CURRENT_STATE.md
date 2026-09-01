# OpenClaw Current State — Live Instance Catalog

**Instance version:** v2026.4.25
**Screenshots reviewed:** 25 total
- 20 from 2026-04-26, 22:46:24 – 22:53:08 CDT (extended UI tour)
- 5 from 2026-04-27, 09:09:30 – 09:11:24 CDT (morning)
**Footer status indicator:** green dot — instance reports healthy, gateway connected
**WebSocket gateway:** `wss://openclaw.ubntag.com`
**Workspace path (gateway container):** `/home/node/.openclaw/workspace`

The dashboard is hosted at `openclaw.ubntag.com` and the user is operating it from a Win32 webchat client (`openclaw-control-ui`) connected to a Linux gateway (`linux 6.8.0-90-generic`, x64) at `172.19.0.2`.

---

## Sidebar Navigation Structure (verified)

- **CHAT**: Chat
- **CONTROL**: Overview, Channels, Instances, Sessions, Usage, Cron Jobs
- **AGENT**: Agents, Skills, Nodes, Dreaming
- **SETTINGS**: Config, Communications, Appearance, Automation, Infrastructure, AI & Agents, Debug, Docs

---

## CONTROL — Overview (`224624`, `224644`)

- **Page header:** "Overview — Status, entry points, health."
- **Gateway Access section:**
  - WebSocket URL: `wss://openclaw.ubntag.com`
  - Gateway Token field: populated, masked (placeholder "OPENCLAW_GATEWA…")
  - Password (not stored): empty
  - Default Session Key: `agent:main:telegram:default…`
  - Language: English
- **Snapshot card:** Status `OK`, Uptime `1h`, Tick interval `30s`, Last channels refresh `just now`
- **Counters (metric cards):**
  - **COST $2.40** — 71M tokens, 798 msgs
  - **SESSIONS: 3** — recent session keys tracked by gateway
  - **SKILLS: 57/57** — 57 active
  - **CRON: 1 job** — Next wake Mon 4/27/2026 7:00 AM (in 8h)
- **Recent Sessions** (3 visible):
  - `Gus Sanchez (@wirelessgus)` id `8603473262` — `deepseek-v4-flash` — just now
  - `agent:main:telegram:default:direct:8603473262` — `deepseek-v4-flash` — 5m ago
  - `Cron: tuna-monitor` — `deepseek-v4-flash` — 8m ago
- **Attention banner:** "Skills with missing dependencies — 1password, apple-notes, apple-reminders +45 more"
- **Event Log:** 125 entries; Gateway Logs: 152 entries; live `health` events streaming
- Helper text: "Use Channels to link WhatsApp, Telegram, Discord, Signal, or iMessage."

---

## CONTROL — Channels (`224705`)

- **Telegram channel** is the only one shown:
  - Configured: **Yes**
  - Running: **Yes**
  - Mode: **polling**
  - Last start: 1h ago
  - Last probe: just now (status: "Probe ok")
  - Sub-sections (collapsed): Accounts, Ack Reaction (empty input), Actions, Allow From (0 items)

---

## CONTROL — Instances (`224720`)

Two connected instances:
1. **`31902fc41e88`** (gateway) — `172.19.0.2`, version `2026.4.25`, tags: `gateway`, `linux 6.8.0-90-generic`, `Linux`, `x64`, `2026.4.25`. Last seen "just now", reason `self`.
2. **`openclaw-control-ui`** — `104.28.163.58`, tags: `webchat`, `operator`, `5 scopes`, `Win32`, `control-ui`. 2m ago, reason `connect`.

---

## CONTROL — Sessions (`224735`)

- Store: (multiple), filter by Active/Limit/Global/Unknown
- 3 sessions in table (1-3 of 3 rows):
  | Key | Label | Kind | Updated | Tokens | Compaction |
  |---|---|---|---|---|---|
  | `agent:main:main` | "Gus Sanchez (@wirelessgus) id:8603473262" | direct | 2m ago | 158,230 / 1,000,000 | none |
  | `agent:main:telegram:default:direct:8603473262` | (optional) | direct | 6m ago | 34,550 / 1,000,000 | none |
  | `agent:main:cron:b87190b2-41c3-4adc-8d70-1ad1df9b60bf` | "Cron: tuna-monitor" | direct | 9m ago | 13,957 / 200,000 | none |
- All four per-session toggles (Thinking, Fast, Verbose, Reasoning) set to **inherit**
- Each row exposes "Show checkpoints"

---

## CONTROL — Usage (`224752`)

- Filters: Today / 7d / 30d, date range pickers, Local timezone, Tokens/Cost toggle
- Range: 6 sessions, 71.1M tokens, $2.40 cost
- **Usage Overview metric grid:**
  - Messages: **798** (157 user + 641 assistant)
  - Throughput: **38.9K tok/min** ($0.0013/min)
  - Tool calls: **459** (12 tools used)
  - Avg tokens/msg: **89.2K** across 798 messages
  - Cache hit rate: **95.4%** (67.7M cached / 71.0M prompt)
  - Error rate: **5.64%** (45 errors over 10h 9m avg session)
  - Avg cost/msg: **$0.0030** ($2.40 total)
  - Sessions: 6 of 6 in range
  - Errors: 45 (0 tool results errors)
- **Top Models:** `deepseek-v4-flash` $2.40 / 71.1M / 616 msgs · `gemini-2.5-flash-lite` $0.00 / 0 / 5 msgs · `claude-sonnet-4.6` $0.00 / 0 / 20 msgs
- **Top Providers:** `deepseek` $2.40 · `google` $0.00 · `anthropic` $0.00
- **Top Tools:** exec 258, write 60, read 59, process 32
- **Top Agents:** `main` $2.40 / 71.1M

---

## CONTROL — Cron Jobs (`224806`, `224825`)

- Enabled: **Yes** · Jobs: **1** · Next wake: Mon 4/27/2026 7:00 AM (in 8h)
- **One job: `morning-digest`**
  - Cron expression: `0 7 * * *` (America/Chicago)
  - Status: n/a (never run yet visible)
  - Prompt: *"Pull my inbox summary (unread count, top 5 important unread emails with subject/sender), check my calendar for today, and deliver a clean morning digest. Be concise."*
  - Delivery: `announce (telegram -> 8603473262)`
  - State chips: `enabled`, `isolated`, `now` action button
  - Action buttons: Edit, Clone, Disable, Run, Run if due, History, Remove
- "New Job" form on right with Basics (Name, Description, Agent ID, Enabled), Schedule (Every, Unit) — empty
- Run history: "1 shown of 1"

---

## AGENT — Agents (`224846`)

- Agent selector: `main (default)` (only agent)
- Tabs: **Overview · Files (7) · Tools · Skills · Channels (1) · Cron Jobs**
- Currently on Files tab — "Core Files: Bootstrap persona, identity, and tool guidance."
- Workspace: `/home/node/.openclaw/workspace`
- Seven file tabs visible: **AGENTS · SOUL · TOOLS · IDENTITY · USER · HEARTBEAT · MEMORY**
- "Select a file to edit" — no file open in screenshot
- Top-right buttons: Copy ID · Default · Refresh

---

## AGENT — Skills (`224904`, `224923`, `224956`, `225019`, `225041`, `225109`, `225131`)

- Filter buttons: **All 57 · Ready 9 · Needs Setup 48 · Disabled 0**
- "ClawHub" search bar: "Search and install skills from the registry"
- "Built-in Skills" section heading: 52 items
- "Extra Skills" section heading: 5 items
- Status dot color: **green** = Ready, **orange** = Needs Setup
- All skills shown have toggle = **on (enabled)**

### Built-in Skills observed (orange = needs setup, green = ready)

Orange/needs-setup: `1password`, `apple-notes`, `apple-reminders`, `bear-notes`, `blogwatcher`, `blucli`, `bluebubbles`, `camsnap`, `clawhub` (no dot — likely ready), `coding-agent`, `discord`, `github`, `gog`, `goplaces`, `himalaya`, `imsg`, `mcporter`, `model-usage`, `nano-pdf`, `notion`, `obsidian`, `openai-whisper`, `openhue`, `oracle`, `ordercli`, `peekaboo`, `session-logs`, `sherpa-onnx-tts`, `slack`, `songsee`, `sonoscli`, `spotify-player`, `summarize`, `things-mac`, `tmux`, `trello`, `video-frames`, `voice-call`, `wacli`, `xurl`

Green/ready: `healthcheck`, `node-connect`, `openai-whisper-api`, `skill-creator`, `taskflow`, `taskflow-inbox-triage`, `weather`

### Extra Skills (5 items)

Green/ready: `acp-router` ("Route plain-language requests for Pi, Claude Code, Cursor, Copilot, OpenClaw ACP, OpenCode, Gemini CLI, Qwen, Kiro, Kimi, iFlow, Factory Dr…"), `browser-automation` ("controlling web pages with the OpenClaw browser tool, especially multi-step flows, login checks, tab management, or recovery from…")

Orange/needs-setup: `qqbot-channel` (Chinese description for QQ frequency channel management), `qqbot-media` (QQ rich media), `qqbot-remind` (QQ scheduled reminder)

---

## AGENT — Nodes (`225154`, `225227`)

- **Page subtitle:** "Paired devices and commands."
- **Exec approvals card:**
  - Target: **Gateway** (Host dropdown)
  - Scope tabs: **Defaults**, `main`
  - Security mode: **Deny**
  - Ask mode: **On miss**
  - Ask fallback: **Deny**
  - Auto-allow skill CLIs: disabled (checkbox unchecked)
- **Exec node binding card:**
  - Default binding: **Any node** ("No nodes with system.run available.")
  - Binding for `main` agent: **Use default**
- **Devices card → Paired (2 devices):**
  1. `52f60f2891553c1665c0d22cb8a3cbdd033a71169876f7be05a200b70f926903` — IP `104.28.163.58` — roles: `operator` — scopes: `operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing` — token "operator · active" 35h ago — Rotate/Revoke buttons
  2. `ad65d0856883feb97b2070cec87ea82097d59823c39a8bfb8486ed4d6a0ae5fd` — roles: `operator` — same scopes plus `operator.talk.secrets` — 35h ago
- **Nodes card:** "No nodes found."

---

## AGENT — Dreaming (`225250`, `090930`, `090949`)

- **Top-right indicator:** "DREAMING OFF" (red dot)
- **Tabs: SCENE · DIARY · ADVANCED**
- **Scene tab:** Animated red blob avatar with "Z" sleep marks. Status: **DREAMING IDLE**, "0 promoted". Three phase indicators all OFF: `LIGHT off`, `DEEP off`, `REM off`. Sun icon top-right.
- **Diary tab:** "DREAM DIARY" with three sub-tabs: **Dreams**, **Imported Insights**, **Memory Palace**, plus **Reload** button. Body: *"This is the raw dream diary the system writes while replaying and consolidating memory; use it to inspect what the memory system is noticing, and where it still looks noisy or thin."* Empty state: "No dreams yet — Dreams will appear here after the first dreaming cycle runs."
- **Advanced tab:**
  - Action buttons row: **Dedupe Diary · Repair Dream Cache · Backfill · Reset · Clear Replayed**
  - Section: "Daily Log Review — Review what came from the daily log, what is waiting for promotion, and what was promoted recently." Counts: `0 from daily log · 0 waiting · 0 promoted today`
  - Sub-sections (all empty):
    - **From the daily log** — "No staged grounded replay entries right now." (0)
    - **Waiting for promotion** with sort toggle (Most recent / Strongest support) — "No short-term entries to inspect." (0)
    - **Recent promotions** — "No recent promotions to inspect." (0)

---

## SETTINGS — Config (`091004`)

- Top-right: "Advanced →" link
- **Model & Thinking card:**
  - Model: **default**
  - Thinking: tabs Off / Low / Medium / High → currently `Off` selected
  - Fast mode: toggle off
- **Channels card:** "1 Connected — Telegram: Configured"
- **Automations card:** "0 scheduled tasks · Manage →", "0 skills installed · Browse →", "1 MCP server · Configure →"
- **Security card** (Configure →):
  - Gateway auth: **Token** (green chip)
  - Exec policy: **Allowlist**
  - Device auth: **Enabled**
- **Appearance card:**
  - Theme: tabs **Claw / Knot / Dash / Custom** → `Claw` selected
  - Mode: Light / Dark / **System** → `System` selected
  - Roundness: None / Slight / **Default** / Round / Full → `Default`
- **Personal card:**
  - "Gus — This browser only"
  - Name: `Gus`
  - Avatar text/emoji: empty (placeholder "JD or 🐯")
  - Choose image / Clear buttons
- **Profile card** (4 profile chips):
  - Personal Assistant — "Balanced context and cost. Best for daily use."
  - Code Agent — "Higher context for coding tasks. More tokens per turn."
  - **Team Bot** (selected/highlighted) — "Multi-channel, group-aware. Leaner per-turn context."
  - Minimal — "Lowest cost per turn. Fast and lean."
- Footer: "● Connected · Jarvis · v2026.4.25"

---

## SETTINGS — Communications (`091049`, `091124`)

- Subtitle: "Channels, messages, and audio settings."
- Top toolbar: status `No changes`, note "Raw mode disabled (snapshot cannot safely round-trip raw text)", buttons: Open / Reload / Clear / Save / Apply / Update
- Sub-tabs: **Communication / Channels / Messages / Broadcast / Talk / Audio**
- **Communication tab (`091049`):**
  - **Broadcast section** ("Broadcast and notification settings"):
    - Broadcast Strategy: tabs `parallel` / `sequential` (advanced)
    - Custom entries: Add Entry button, "No custom entries."
  - **Audio section** ("Audio input/output settings"):
    - Audio Transcription (sub-section, expanded, `media` tag visible)
- **Channels tab (`091124`):**
  - Channels card: "Messaging channels (Telegram, Discord, Slack, etc.)"
  - **BlueBubbles** entry expanded:
    - Tags: `network`, `channels`
    - Description: "iMessage via the BlueBubbles mac app + REST API."
    - Sub-sections: Accounts (collapsed), Actions (expanded showing Allow From), Allow From (0 items, Add button)

---

## Atomic Configured-Features List

These are concrete features the user has actively set up (will be left column of gap-analysis):

1. Gateway hosted at `wss://openclaw.ubntag.com` with token auth
2. Default session key `agent:main:telegram:default`
3. Telegram channel configured + running (polling mode)
4. Cron job `morning-digest` — daily 7 AM CT, delivers to Telegram chat `8603473262`
5. Single agent: `main` (default), workspace `/home/node/.openclaw/workspace`
6. Active model in routing: `deepseek-v4-flash` (driving 71M of 71.1M tokens)
7. Secondary models reachable but unused this window: `gemini-2.5-flash-lite`, `claude-sonnet-4.6`
8. 57 skills installed, 9 marked Ready: `healthcheck`, `node-connect`, `openai-whisper-api`, `skill-creator`, `taskflow`, `taskflow-inbox-triage`, `weather`, `acp-router`, `browser-automation`
9. Two paired operator devices (with rotate/revoke tokens) under Nodes
10. MCP servers: 1 configured (Config card shows "1 MCP server")
11. Profile selected: **Team Bot**
12. Theme: Claw, Mode: System, Roundness: Default
13. Security: Token gateway auth, Allowlist exec policy, Device auth enabled
14. Exec approvals on Gateway target: Security=Deny, Ask=On miss, Fallback=Deny
15. Auto-compaction & per-session knobs (Thinking/Fast/Verbose/Reasoning) all set to `inherit`
16. BlueBubbles channel definition present in Communications (settings authored, no accounts/allow-from filled)
17. Broadcast strategy controls exposed (parallel vs sequential, no custom entries)
18. Two operator paired devices with full scope set including `operator.talk.secrets` on one
19. Cache hit rate 95.4%, indicating prompt caching is active
20. Tool footprint: `exec`, `write`, `read`, `process` are the top 4 tools used

---

## Visible-but-Unconfigured

UI exposes these surfaces but the user has not populated/enabled them:

- **Channels (Telegram tab)**: Accounts collapsed/empty, Ack Reaction empty, Actions empty, Allow From `0 items`
- **48 of 57 skills** are in **Needs Setup** state (most popular CLIs: 1password, apple-notes/reminders, bluebubbles, github, gog, slack, notion, obsidian, etc.)
- **Custom broadcast entries**: 0
- **Cron job pipeline**: only 1 job exists; "New Job" form is blank
- **Agents**: only `main`; no additional agents created
- **Nodes**: "No nodes found" — devices paired but no active node attached
- **Default node binding**: Any node, "No nodes with system.run available"
- **Auto-allow skill CLIs**: unchecked
- **Dreaming**: master toggle OFF; 0 dreams, 0 promotions, 0 daily-log entries
- **Personal avatar** image: empty
- **BlueBubbles channel**: expanded but Accounts empty, Allow From 0, Actions empty
- **Audio Transcription**: sub-section visible but no provider configured visibly
- **Channel coverage**: Discord/Slack/WhatsApp/Signal/iMessage all advertised in helper text but only Telegram is wired (BlueBubbles is authored in settings raw, not "1 Connected")

---

## Cross-Reference Table: Screenshot → Page

| Filename | Page Shown |
|---|---|
| `Screenshot 2026-04-26 224624.jpg` | CONTROL → Overview (full page, including Recent Sessions + Attention banner) |
| `Screenshot 2026-04-26 224644.jpg` | CONTROL → Overview (top portion, gateway access + snapshot) |
| `Screenshot 2026-04-26 224705.jpg` | CONTROL → Channels (Telegram detail) |
| `Screenshot 2026-04-26 224720.jpg` | CONTROL → Instances |
| `Screenshot 2026-04-26 224735.jpg` | CONTROL → Sessions |
| `Screenshot 2026-04-26 224752.jpg` | CONTROL → Usage |
| `Screenshot 2026-04-26 224806.jpg` | CONTROL → Cron Jobs (sidebar collapsed) |
| `Screenshot 2026-04-26 224825.jpg` | CONTROL → Cron Jobs (sidebar expanded showing AGENT submenu) |
| `Screenshot 2026-04-26 224846.jpg` | AGENT → Agents (Files tab) |
| `Screenshot 2026-04-26 224904.jpg` | AGENT → Skills (top, ClawHub + first builtins) |
| `Screenshot 2026-04-26 224923.jpg` | AGENT → Skills (apple-notes through discord) |
| `Screenshot 2026-04-26 224956.jpg` | AGENT → Skills (github through node-connect) |
| `Screenshot 2026-04-26 225019.jpg` | AGENT → Skills (nano-pdf through peekaboo) |
| `Screenshot 2026-04-26 225041.jpg` | AGENT → Skills (session-logs through taskflow-inbox-triage) |
| `Screenshot 2026-04-26 225109.jpg` | AGENT → Skills (taskflow through xurl) |
| `Screenshot 2026-04-26 225131.jpg` | AGENT → Skills (voice-call/weather/xurl + Extra Skills section) |
| `Screenshot 2026-04-26 225154.jpg` | AGENT → Nodes (top, Exec approvals) |
| `Screenshot 2026-04-26 225227.jpg` | AGENT → Nodes (middle, Exec node binding + Devices) |
| `Screenshot 2026-04-26 225250.jpg` | AGENT → Nodes (Devices full + Paired tokens) |
| `Screenshot 2026-04-26 225308.jpg` | AGENT → Dreaming (Scene tab) |
| `Screenshot 2026-04-27 090930.jpg` | AGENT → Dreaming (Diary tab, empty) |
| `Screenshot 2026-04-27 090949.jpg` | AGENT → Dreaming (Advanced tab) |
| `Screenshot 2026-04-27 091004.jpg` | SETTINGS → Config |
| `Screenshot 2026-04-27 091049.jpg` | SETTINGS → Communications (Communication sub-tab) |
| `Screenshot 2026-04-27 091124.jpg` | SETTINGS → Communications (Channels sub-tab → BlueBubbles) |

---

## Gaps the Screenshots Cannot Tell Us

These OpenClaw surfaces were either not visited or not captured in detail; future agents will need to probe them from filesystem, gateway API, or docs:

1. **MCP servers** — Config says "1 MCP server" but the MCP detail screen was never opened. Which server? What tools? What URL?
2. **Plugins** — No "Plugins" page was screenshotted. We know clawtalk plugin was attempted/uninstalled (per memory) but plugin registry state is unknown.
3. **Agent file contents** — AGENTS / SOUL / TOOLS / IDENTITY / USER / HEARTBEAT / MEMORY tabs exist but no file body was opened. The persona, identity, and tool guidance are invisible from screenshots.
4. **Skill registry** (ClawHub) — search bar shown but never used; we don't know what skills are *available* but not installed.
5. **Settings → Appearance / Automation / Infrastructure / AI & Agents / Debug / Docs** — these sidebar items exist but were not opened/screenshotted.
6. **Communications → Messages, Broadcast, Talk, Audio (full)** — only Communication and Channels sub-tabs explored. Talk (voice/realtime?) and Audio Transcription internals unseen.
7. **Chat surface** — never opened; we don't know default model, prompt, history surface, or composer affordances.
8. **Cron Jobs > New Job form** — only the form skeleton; we don't see the full schedule expression UI, or whether dependent jobs / chains are supported.
9. **Sessions checkpoints** — "Show checkpoints" never expanded; checkpoint format unknown.
10. **Usage filters** — Agent / Channel / Provider / Model / Tool filters all set to "All" — we don't know what alternates exist.
11. **Dreaming Memory Palace and Imported Insights** sub-tabs — both empty in screenshot, structure unknown.
12. **Operator scopes semantics** — what `operator.talk.secrets` actually grants is not explained in UI.
13. **Webchat Chat page** — the CHAT sidebar section is entirely uncovered.
14. **Underlying agent definitions / skill registry on disk** — needs server-side filesystem probe (`/home/node/.openclaw/workspace`).
15. **Docs section** — sidebar item present but never opened; could be in-app reference for everything we're guessing about.

---

*Generated 2026-04-27 from `_current_state/` snapshot.*
