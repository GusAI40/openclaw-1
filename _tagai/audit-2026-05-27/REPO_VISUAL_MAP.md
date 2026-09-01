# TAG / OpenClaw — Visual Repo Map

**Audit date:** 2026-05-27
**Scope:** TAG-owned layers only. Upstream OpenClaw (`src/`, `extensions/`, `packages/`, `ui/`, `apps/`) is out of scope — that's openclaw/openclaw's job, not TAG's.

---

## Plain-English Frame

Think of this repo as a **state** (TAG AI). Inside the state, three **cities** make or protect money. Each city has **streets** (modules), **houses** (services), **rooms** (configs), and **workers** (agents/crons). Outside the state, **trading partners** (providers like DeepSeek, Anthropic, Kie.ai, Telegram) send goods in and money out.

If a city's lights go out, a specific revenue stream stops. We'll name each one.

---

## State map (top level)

```mermaid
flowchart TD
    subgraph TAG_STATE["TAG AI State"]
        direction TB
        CITY_RUNTIME["City A — Jarvis Runtime<br/>(forked OpenClaw, customized via _tagai overlay)"]
        CITY_INFRA["City B — Hetzner Deploy Layer<br/>(VPS, Caddy, Docker, tenants, backups)"]
        CITY_PIPE["City C — Outbound Pipelines<br/>(rescue-websites-sim, mcp-servers, brand layer)"]
    end

    USERS["Founders / End users<br/>Telegram, Web Dashboard, Voice, CLI"] --> CITY_RUNTIME
    CITY_RUNTIME <--> CITY_INFRA
    CITY_RUNTIME --> CITY_PIPE

    CITY_RUNTIME --> PROVIDERS["Trading partners (LLMs + tools)<br/>DeepSeek · Anthropic · Google AI · OpenAI · Kie.ai · Microsoft Graph · Supabase · Resend · Cloudflare Pages"]
    CITY_PIPE --> PROVIDERS
    CITY_INFRA --> BACKUP["Off-site backup<br/>GusAI40/tagai-cloud-backups (age-encrypted, orphan branches)"]
```

---

## City A — Jarvis Runtime (the brain)

```mermaid
flowchart LR
    subgraph CITY_A["City A — Jarvis Runtime"]
        GATEWAY["openclaw-gateway container<br/>:18789 (Gus) / :18884 (Julian)"]
        CLI["openclaw-cli container<br/>shares gateway netns"]
        AGENT["agents/main runtime<br/>session JSONL files + lock files"]
        AUTH["auth-profiles.json<br/>(mode 600, NOT in git)"]
        CHANNELS["channels<br/>telegram · web dashboard · voice · acpx · device-pair"]
        PLUGINS["7 plugins<br/>acpx · browser · device-pair · memory-core · phone-control · talk-voice · telegram"]
    end

    USER_MSG["User message<br/>(Telegram / web / voice)"] --> CHANNELS --> GATEWAY --> AGENT
    AGENT --> LLM["LLM call<br/>primary: deepseek-v4-flash<br/>fallbacks: gemini-2.5-flash-lite, claude-haiku, claude-sonnet"]
    AGENT --> TOOLS["Tool calls<br/>exec, image_generate, browser, MCP servers"]
    AGENT --> REPLY["Reply pipeline<br/>back through channel"]
    REPLY --> USER_MSG
    AUTH -.reads.-> LLM
```

**Workers in this city:**
- **Telegram poller** — long-polls Telegram every few seconds, hands messages to gateway
- **Heartbeat cron** — runs every 30m (Gus) / 12h (Julian) per `openclaw.json:agents.defaults.heartbeat`
- **Health monitor** — interval 300s, restarts unhealthy components

---

## City B — Hetzner Deploy Layer (the building)

```mermaid
flowchart TB
    subgraph HOST["Hetzner CPX21 — tagai-cloud — 87.99.148.242"]
        CADDY["Caddy v2.11.2 on host (systemd)<br/>TLS via Let's Encrypt<br/>NOT Docker, NOT Traefik, NOT Coolify"]
        subgraph DOCKER["Docker"]
            GUS_GW["openclaw-gateway-1<br/>:18789"]
            GUS_CLI["openclaw-cli-1"]
            JUL_GW["openclaw-julian-gateway<br/>:18884"]
            BS_VOICE["brightsmile voice demo<br/>:18080 (separate repo)"]
        end
        BACKUP_CRON["backup.sh @ 03:00 UTC<br/>sync-to-github-split.sh @ 03:30 UTC"]
        DEVICE_CRON["auto-approve-julian-devices.sh<br/>(every 30s, Julian only)"]
        SHARED["/home/tagai/shared-projects/<br/>{rescue-websites, awesome-design-md}<br/>bind-mounted into all tenants"]
    end

    INTERNET["*.ubntag.com DNS<br/>(Vercel-managed)"] --> CADDY
    CADDY -- "openclaw.ubntag.com" --> GUS_GW
    CADDY -- "julian.ubntag.com" --> JUL_GW
    CADDY -- "brightsmile.ubntag.com" --> BS_VOICE

    BACKUP_CRON --> AGE["age-encrypt + 90MB split"] --> GITHUB["GusAI40/tagai-cloud-backups<br/>(orphan branches, private)"]
    DEVICE_CRON --> JUL_GW
    SHARED -.mount.-> GUS_GW
    SHARED -.mount.-> JUL_GW
```

---

## City C — Outbound Pipelines (the trucks leaving the state)

```mermaid
flowchart LR
    subgraph CITY_C["City C — Outbound Pipelines"]
        SIM["rescue-websites-sim/<br/>standalone npm project<br/>3 blindspot simulators"]
        MCP_GRAPH["mcp-servers/microsoft-graph/<br/>6 tools: mail, calendar, drive"]
        BRAND["_tagai/BRAND.md + assets<br/>Jarvis identity layer"]
    end

    SIM -- "validates before live send" --> RW_LIVE["rescue-websites (live pipeline,<br/>under /home/tagai/shared-projects/)"]
    RW_LIVE --> RESEND["Resend (transactional email)"]
    RW_LIVE --> CFPAGES["Cloudflare Pages<br/>(Julian deployed today via gh CLI)"]

    MCP_GRAPH --> MSGRAPH_API["Microsoft Graph API<br/>(Entra ID client-credentials)"]

    JARVIS["Jarvis (City A)"] -.invokes MCP.-> MCP_GRAPH
    JARVIS -.runs sims.-> SIM
```

---

## Cross-city wires (where money flows or breaks)

| Wire | Direction | What flows | Failure cost |
|---|---|---|---|
| Caddy → Gus gateway | inbound | Founder's own Jarvis traffic | Personal productivity stops (no revenue, but blocks every other workstream) |
| Caddy → Julian gateway | inbound | Julian's first paid-customer-like tenant | Tenant unusable. Today's incident was here. |
| Gateway → DeepSeek | outbound | All primary LLM calls | Falls back to Gemini → Anthropic chain |
| Gateway → Anthropic | outbound | Fallback LLM | **Broken for Gus main** (dotted model IDs) |
| Gateway → Telegram | outbound | Replies to founders | Lane jam = silent loss (just happened to Julian) |
| Hetzner → GitHub backups | nightly | Encrypted state snapshots | Without age key in 1Password, backup is unrecoverable |
| Shared bind-mounts | host → tenant | rescue-websites runtime + design assets | If symlinks used instead of bind-mounts, breaks silently |

---

## What's intentionally NOT mapped here

- Upstream OpenClaw `src/`, `extensions/`, `packages/`, `ui/`, `apps/`, `docs/` — not TAG-owned, not pushed by TAG.
- TAG-AI Vercel website (`ubntag.com` itself, including `/maps/*`, `/erate`, `/industries/*`) — separate repo `TAG_ai`, has its own vercel-routing rule in `~/.claude/rules/`.
- Voice demo (`voice-agent-demo`) — separate repo, runs on the same Hetzner box as `brightsmile.ubntag.com:18080`.
- Spectrum / Michelle / E-Rate / VoiceAI pipelines — separate TAG project repos.

See `TECHNICAL_ARCHITECTURE.md` for city writeups and worker tables.
