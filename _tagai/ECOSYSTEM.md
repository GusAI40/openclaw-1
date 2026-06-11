# TAG AI / OpenClaw Ecosystem Map

> Canonical map of the deployed Hetzner box (`tagai-cloud`, 87.99.148.242).
> Last audited: 2026-06-11. Regenerate via `.artifacts/cred_audit.py` (credentials)
> and `docker ps` + the two `openclaw.json` configs (containers/MCP).

## Topology at a glance

```
                       Caddy (host, TLS for *.ubntag.com)
                                    │
        ┌───────────────┬───────────┴───────┬──────────────────┐
        ▼               ▼                   ▼                  ▼
 openclaw.ubntag   julian.ubntag      cma.ubntag        voiceai.ubntag
        │               │                   │                  │
        ▼               ▼                   ▼                  ▼
 ┌──────────────┐ ┌──────────────┐   ┌────────────┐    ┌────────────┐
 │ openclaw-    │ │ openclaw-    │   │ michelle-  │    │ (voice AI) │
 │ openclaw-    │ │ julian-      │   │ cma        │    │            │
 │ gateway-1    │ │ gateway      │   └────────────┘    └────────────┘
 │ (Gus bot)    │ │ (Julian bot) │
 │ :18789       │ │ :18789→18884 │   tour-book (buyer tour-book app)
 └──────┬───────┘ └──────┬───────┘
        │ 20 MCP         │ 9 MCP
        ▼                ▼
   external service providers (see §5)

 compose project "openclaw"        → service: openclaw-gateway  (openclaw-cli REMOVED 2026-06-11)
 compose project "openclaw-julian" → service: openclaw-gateway
```

## 1. Docker containers

| Container | Role | Status |
| --- | --- | --- |
| `openclaw-openclaw-gateway-1` | Gus primary OpenClaw gateway | healthy ✅ |
| `openclaw-julian-gateway` | Julian tenant OpenClaw gateway | healthy ✅ |
| `michelle-cma` | Michelle CMA report API | healthy ✅ |
| `tour-book` | Buyer tour-book generator | healthy ✅ |

> `openclaw-openclaw-cli-1` was a stale interactive REPL (not infrastructure) — removed permanently 2026-06-11.

## 2. Compose projects

| Project | Path | Services |
| --- | --- | --- |
| `openclaw` (Gus) | `/home/tagai/openclaw` | `openclaw-gateway` |
| `openclaw-julian` | `/home/tagai/tenants/julian/openclaw` | `openclaw-gateway` |

Container naming = `{project}-{service}-{replica}`.

## 3. Public domains (Caddy on host, not in Docker)

| Domain | Target |
| --- | --- |
| `openclaw.ubntag.com` | Gus gateway (loopback :18789) |
| `julian.ubntag.com` | Julian gateway (loopback :18884) |
| `cma.ubntag.com` | michelle-cma API |
| `voiceai.ubntag.com` | Voice AI |

## 4. MCP servers (tools each bot can call)

| Tenant | MCP servers |
| --- | --- |
| **Julian (9)** | github, supabase, vercel, microsoft-graph, resend, telnyx, kie-ai, jarvis-vapi, tag-ai-functions |
| **Gus (19)** | all of Julian's **+** apify, apollo-io, browserbase, chrome-devtools, cloudflare-browser, cloudflare-docs, exa, minimax, notebooklm, parallel-browser |

## 5. External service providers (by category)

| Category | Providers |
| --- | --- |
| AI / LLM | Anthropic, OpenAI, Google/Gemini, DeepSeek, Groq, Mistral, Minimax |
| Voice / telephony | Telnyx, VAPI, LiveKit, Cartesia, Deepgram, Twilio *(key empty)* |
| Data / infra | Supabase, Vercel, Cloudflare, Hetzner *(Gus only)* |
| Automation | *(none active — see Retired Tools)* |
| Search / scrape | Tavily, Exa, Apify, Apollo, Browserbase, Firecrawl *(empty)* |
| Media generation | Kie.ai, Suno *(placeholder)* |
| Communications | Resend (email), Telegram bots, Microsoft Graph (mail/calendar) |
| Real-estate domain | SimplyRETS, CMA API, Michelle-Maya bot |
| Observability / misc | Langfuse, OpenWeather, ClawTalk |

## 6. Credential policy (internal phase)

| Credential | Policy |
| --- | --- |
| GitHub PAT | **Tenant-specific** — Gus=GusAI40, Julian=JaBeanJr ✅ |
| Telegram bot token | **Tenant-specific** ✅ |
| Gateway auth token | **Tenant-specific** ✅ |
| Supabase | Shared-platform ✅ |
| Vercel | Shared-platform ✅ |
| Telnyx / VAPI / LiveKit | Shared-platform ✅ |
| MS Graph | Shared-platform (Julian acts as gus@ubntag.com — isolation pending) |
| AI / utility keys | Shared-platform ✅ |

Rule: shared credentials are allowed only for internal TAG tenants. Future **client** tenants get fully isolated credentials.

## 7. Retired / historical tools

- **n8n** — previously used for workflow automation via `tagaiai.app.n8n.cloud`. Retired 2026-06-11: the cloud workspace was deleted (endpoint returns 404), so the tool was unusable. Removed from Julian (2026-06-10) and Gus (2026-06-11). **Do not restore** unless a new n8n workspace + endpoint is intentionally provisioned.

## 8. Open items / forward-looking

- Rotate the two live GitHub PATs (`ghp_mfbk…` Gus, `ghp_dmlf…` Julian) — both passed through chat transcripts.
- Shared Supabase `sbp_v0_60bf…` is live in **both** configs — if rotated, update Gus AND Julian in the same window or one tenant breaks. (A separate "revoke sbp token" item exists from the 2026-06-08 SalesEdge session — confirm if same token first.)
- MS Graph is the first real tenant-isolation target.
- Hygiene: stale `.env.bak*` files holding secrets; Gus browserbase MCP uses an old Gemini key.
- Cross-tenant GitHub access works via collaborator grants (no shared PATs); verified both directions 2026-06-10.
