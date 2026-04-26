# INTEGRATION.md — OpenClaw in the TAG AI Stack

OpenClaw is the **inbox/channel gateway** for TAG AI. It sits at the edge of the founder's communication surface (WhatsApp, Telegram, Slack, iMessage), routes messages to a Claude-powered conversation layer, and lets Claude invoke skills and JARVIS pipeline agents on the founder's behalf. OpenClaw owns conversation state and channel transport. It does **not** own business logic or data — those belong to JARVIS, Supabase, and the underlying tools.

## Architecture

```
                      Founder messaging surface
   WhatsApp     Telegram     Slack     iMessage     SMS (Telnyx)
       \           |           |           /            /
        \          |           |          /            /
         \         |           |         /            /
          \________v___________v________v____________/
                            |
                            v
              +-------------------------------+
              |  OpenClaw Gateway (Hetzner)   |
              |  - channel adapters           |
              |  - conversation state         |
              |  - skill router               |
              |  domain: openclaw.ubntag.com  |
              +---------------+---------------+
                              |
                              v
              +-------------------------------+
              |   Claude (with TAG context)   |
              |   - reads MEMORY.md pointers  |
              |   - decides which skill/agent |
              +---------------+---------------+
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
     +----------------+ +-----------+ +------------------+
     | JARVIS pipeline| | Supabase  | | Skills (Resend,  |
     | (E-Rate,       | | (truth)   | | Mapbox, HeyGen,  |
     |  Spectrum,     | |           | | Salesforce, etc) |
     |  Michelle,     | |           | |                  |
     |  Copper)       | |           | |                  |
     +----------------+ +-----------+ +------------------+
                              |
                              v
                   Reply travels back through
                  OpenClaw to the founder's channel
```

## Boundaries

**OpenClaw IS responsible for:**
- Channel transport (receive WhatsApp/Telegram/Slack/iMessage, send replies)
- Conversation state per channel/user (history, threading, quick context)
- Authenticating the founder (only Gus's verified channel IDs)
- Routing messages into Claude with the right system prompt and skill list
- Returning Claude's response on the same channel the message came in on

**OpenClaw is NOT responsible for:**
- Business logic — JARVIS pipeline owns proposal generation, outreach send logic, Michelle's listing ops
- Data ownership — Supabase is the source of truth for entities, contacts, send ledger, deal state
- Email sending — Resend (via JARVIS skills) sends client emails; OpenClaw just triggers the skill
- Long-running automation — scheduled jobs run on Hetzner cron / Coolify scheduled tasks, not in OpenClaw
- Knowledge storage — Pinecone (`tag-vault`) and Obsidian vault hold long-term knowledge; OpenClaw queries them via skills

If a feature requires persistence, lookups, or external API calls, OpenClaw invokes a skill or JARVIS agent. It does not implement the logic itself.

## Example Flows

### (a) "Schedule a meeting with Solomon next Tuesday at 10am"

1. WhatsApp message hits OpenClaw gateway
2. OpenClaw routes to Claude with calendar skills loaded
3. Claude calls Google Calendar skill (via the `setup-google-workspace` integration) to create the event
4. Calendar skill returns event ID + meet link
5. Claude composes confirmation, OpenClaw replies on WhatsApp

### (b) "What's the status of the John Muir proposal?"

1. Telegram message hits OpenClaw gateway
2. Claude queries Supabase via JARVIS pipeline skill (`packages/persistence`)
3. Returns: entity status, last sent date, hold/sent/dead bucket, and the verified XLSX pricing from the actual sent email (per `feedback_cross_check_before_csv.md`)
4. Claude formats a one-paragraph status, OpenClaw replies on Telegram

### (c) "Post the new Michelle listing at 1234 Main to the FB rotation"

1. Slack DM hits OpenClaw gateway
2. Claude invokes the `onboard-listing` skill (creates folder structure, adds to `listings.json`)
3. Then invokes `fb-group-poster` skill which interleaves the new property with active listings using A/B copy variations
4. Returns post count and the command-center dashboard URL
5. OpenClaw replies on Slack with the dashboard link

## Cross-References

- **Server, ports, DNS, Coolify:** `C:\Users\gsanc\TAG-Projects-2026\_shared\docs\HETZNER_INFRASTRUCTURE.yaml`
- **JARVIS pipeline architecture, agents, atomic refactor:** `MEMORY.md` (top section + `project_atomic_architecture_2026_03_25.md`, `project_autopilot_v6_2026_03_25.md`)
- **Channel rollout order:** `_tagai/CHANNEL_STRATEGY.md`
- **Skill and agent inventory available to OpenClaw:** `_tagai/CAPABILITIES.md`
- **Deploy runbook:** `_tagai/DEPLOY_HETZNER.md`

## Design Principle

Keep OpenClaw thin. Every piece of business logic belongs in a skill, a JARVIS agent, or Supabase. OpenClaw's job is to be a clean, reliable bridge between the founder's pocket and the rest of the TAG AI stack.
