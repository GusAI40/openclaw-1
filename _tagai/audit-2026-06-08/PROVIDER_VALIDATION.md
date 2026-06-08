# Provider Validation — 2026-06-08

**Method.** Every provider fact below was checked against **live official docs** via the context7 MCP (`/firecrawl/firecrawl-docs`, source reputation: High) on 2026-06-08. Where docs and code disagree, the conflict is stated plainly — not smoothed over.

This is a **delta** validation. It focuses on the one thing that changed since the 2026-05-27 audit: the new, **uncommitted** Firecrawl Agent feature in `extensions/firecrawl/`. The 05-27 provider table for the rest of the stack (DeepSeek, Anthropic, Google/Gemini, OpenAI image/video, Telegram, Caddy) still stands — see `_tagai/audit-2026-05-27/PROVIDER_VALIDATION.md`.

---

## What the new code does (plain English)

Think of the firecrawl extension as a **worker you can hire to go read the web for you**. Until now it could do two jobs: *search* and *scrape one page*. The new work hires a smarter, slower worker — the **Firecrawl Agent** — that can wander a site, follow links, and hand back clean structured data. Three new tools were added:

- `firecrawl_agent` — "go gather this data" (starts the job, hands you a ticket number)
- `firecrawl_agent_status` — "is my data ready?" (checks the ticket)
- `firecrawl_agent_cancel` — "never mind, stop" (tears up the ticket)

## Validation table

| Claim in the code | Where | Live docs say | Verdict |
|---|---|---|---|
| `POST /v2/agent` endpoint exists | `firecrawl-client.ts` | ✅ `POST /v2/agent` documented — "initiates an agent job" | **Confirmed** |
| Models `spark-1-mini` (default) + `spark-1-pro` | `firecrawl-agent-tools.ts` | ✅ Exactly these two, `spark-1-mini` is default | **Confirmed** |
| `prompt` max 10,000 chars | tool schema `maxLength: 10_000` | ✅ "max 10,000 characters" | **Confirmed** |
| `maxCredits` optional spend cap | client body | ✅ Optional, **docs default 2500** | **Confirmed** (see note 2) |
| `strictConstrainToURLs` boolean, default false | client body | ✅ Documented, default false | **Confirmed** |
| `schema` JSON-schema for structured output | client body | ✅ Optional JSON schema | **Confirmed** |
| `GET /v2/agent/<jobId>` for status | `resolveAgentJobEndpoint` | ✅ Documented, returns status + data | **Confirmed** |
| `DELETE /v2/agent/<jobId>` to cancel | `resolveAgentJobEndpoint` | ✅ Cancel documented | **Confirmed** |
| Status fields `status`, `success`, `data`, `expiresAt`, `creditsUsed` | `normalizeFirecrawlAgentPayload` | ✅ Python SDK returns `status/success/data/expires_at/credits_used` | **Confirmed** |

**Bottom line: the Firecrawl Agent feature is NOT hallucinated.** Endpoint, models, and parameters all match current official docs. This is real, well-built integration work.

---

## Two honest conflicts to resolve before shipping

### Conflict 1 — start endpoint: `/v2/agent` vs `/v2/agent/start` (NEEDS A LIVE KEY TO SETTLE)

The docs describe **two** ways to start a job:

- `POST /v2/agent` — "initiates an agent job" (the API-reference page)
- `POST /v2/agent/start` — the **async** pattern: returns a Job ID you poll later (the features/SDK page; the Python SDK's `start_agent()` maps here)

The code POSTs to **`/v2/agent`** but treats the reply as the async pattern — it expects a job `id`, then tells the agent to poll `firecrawl_agent_status`. The tool description even says "Returns a job id; use firecrawl_agent_status to retrieve results."

**Why this matters (money + reliability):** if `POST /v2/agent` is the *synchronous* "wait until done" variant, then (a) it may return the full result in one shot, making the status-poll step pointless, or worse (b) it blocks the call until the agent finishes — which can take minutes — and the code's **60-second default timeout** (`DEFAULT_FIRECRAWL_AGENT_TIMEOUT_SECONDS = 60`) would kill real jobs mid-run. A timed-out job that already spent credits = paying for nothing.

**This cannot be settled from docs alone** — the unit tests mock the HTTP layer, so they pass either way (29/29 green). **Recommended fix:** one live test with a real `fc-` key against both paths; if the async contract is `/v2/agent/start` + `GET /v2/agent/<id>`, point the start call there and raise the start-timeout to match a realistic agent runtime.

### Conflict 2 — credit guardrail default (LOW, but a real spend risk)

Firecrawl's **server-side default `maxCredits` is 2,500**. The code makes `maxCredits` optional and only sends it when the caller provides it. So if Jarvis (or a tenant) calls `firecrawl_agent` without a cap, a single agentic crawl can burn up to **2,500 credits** silently. For a tool an autonomous agent can call on its own, consider a **conservative built-in default** (e.g. 100–250) so a runaway loop can't drain the Firecrawl balance. This is the same "agent calls a paid tool unsupervised" risk pattern as the LLM-fallback spend.

---

## What I could NOT validate

- **Live behavior of the endpoint** — no Firecrawl API key was used in this audit (read-only repo audit). The two conflicts above are the items that require it.
- The rest of the provider stack was not re-validated this pass; the 2026-05-27 table is the reference. Re-validate Google/Gemini key restriction before **2026-06-19** (carried open from R-13 follow-up).
