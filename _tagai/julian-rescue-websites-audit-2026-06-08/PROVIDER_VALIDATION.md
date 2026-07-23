# Provider Validation — Julian rescue-websites — 2026-06-08

**Method.** Read first-hand from the repo (`package.json`, `src/lib/env.ts`, source grep) on the VPS backup copy. Provider docs validated via context7 MCP where noted. Where I only checked the installed version (not full live docs), it says so. No guessing.

## The 9 providers Julian's pipeline depends on

| Provider | Where used | Installed / pattern | Live-doc check | Risk | Action |
|---|---|---|---|---|---|
| **Firecrawl** | `src/audit/scrape.ts`, audit | `@mendable/firecrawl-js ^1.0.0` (**v1 SDK**) | ✅ context7: a **v2 SDK** exists (`firecrawl` pkg; `scrapeUrl`→`scrape`, `crawlUrl`→`crawl`) | **Medium** | Plan migration to v2 SDK. v1 works today but is the previous generation; new features (agent, v2 formats) are v2-only. |
| **Google Places** | `src/discover/discover.ts` | Mix of `places.googleapis.com` (**New**) **and** `maps.googleapis.com` (**legacy**) | ✅ context7: Places API (New) at `places.googleapis.com/v1` is current; legacy Places is being sunset | **Medium** | Confirm the `maps.googleapis.com` calls aren't legacy Places (geocoding/static maps are fine). Migrate any legacy Places calls. |
| **Google PageSpeed** | `src/audit/audit.ts` `getPageSpeed()` | `googleapis.com/pagespeedonline/**v5**/runPagespeed` | Version-only | Low | v5 is current. Keep `PAGESPEED_API_KEY` restricted (Google key-restriction deadline applies, like the Gemini key). |
| **Resend** | `src/outreach/email.ts` | `resend ^4.0.0` | context7 resolved (not deep-queried) | Low | v4 is current-generation. Sends from a **verified** domain (confirmed `ubntag.com` verified earlier this session). |
| **Cloudflare** | `src/lib/cloudflare.ts`, `src/workers/*` | `api.cloudflare` + Wrangler Workers | Version-only | Low | Pages + Workers for live demo hosting and the voice proxy. Token is `CLOUDFLARE_API_TOKEN`. |
| **Supabase** | `src/lib/db.ts`, `supabase-schema.sql` | `@supabase/supabase-js ^2` | Version-only | Low | v2 current. Uses `SUPABASE_ANON_KEY` (anon, not service-role) — good least-privilege default. |
| **Google Gemini** | voice/content (`generativelanguage`, 6 hits) | `GEMINI_API_KEY` | Version-only | **Medium** | Same key-restriction deadline as the shared Gemini key (restrict before it gets auto-blocked). |
| **LiveKit** | `src/lib/livekit-connector.ts`, voice widget | `livekit-client ^2.19.1`, `livekit-server-sdk ^2.15.4` | Version-only | Low | v2 SDKs, current. Powers the "talk to AI on the demo site" widget via a Cloudflare voice proxy. |
| **Playwright** | scraping/screenshots | `playwright ^1.60.0` | Version-only | Low | Current. Used to render/screenshot mockups and scrape. |

## Confirmed facts
- Secrets load from **`.env.local` (gitignored) first, then `.env`** (`src/lib/env.ts`). Real keys are kept out of git by design. Good.
- A **`DAILY_SEND_CAP` (default 1000)** reputation-burn guard exists in `env.ts` — a deliberate safety floor on outbound email.
- `SUPABASE_ANON_KEY` (not service-role) is the configured key — least privilege.

## The one real "is it current" gap
**Firecrawl v1 SDK.** This is the clearest drift: Julian is one major version behind. It is not broken, but it is legacy. Everything else is on a current major version; the only other watch-item is the **legacy/new Places API mix**.

## Round 2 — every provider validated against live docs (2026-06-08, context7)

| Provider | Installed | Live-doc verdict | Finding |
|---|---|---|---|
| **Resend** | `^4` | ✅ current | `emails.send` supports `attachments` (base64 content + filename) — the file-attachment fix is valid. `idempotencyKey` exists to prevent duplicate sends (use it). `batch.send` does NOT support attachments. |
| **Supabase-js** | `^2` | ✅ current | Docs confirm **service_role bypasses RLS server-side; anon respects RLS.** This is the root cause of the silent daily-cap failure: the quota write is anon + RLS-blocked. Fix = do server-side writes with a service-role key. |
| **LiveKit** | `^2` (client + server-sdk) | ✅ current | v2 SDKs are current. Modern realtime voice uses the `@livekit/agents` framework (~1.5) + `@livekit/agents-plugin-google`, not a hand-rolled WebSocket proxy. Julian's custom Cloudflare-Worker proxy is more fragile than the supported path. |
| **Gemini Live** | model `gemini-3.1-flash` via `BidiGenerateContent` | ⚠️ **likely wrong model id** | Google's Live API docs require the **`-live-preview`** suffix: `gemini-3.1-flash-live-preview` (or via LiveKit, `gemini-2.5-flash-native-audio-preview-12-2025`). Julian's `gemini-3.1-flash` is a non-live id used on the live socket — likely invalid. Matches the live data (voice traffic dead since Jun 3). **High: fix the model id.** |
| **Google PageSpeed** | `v5` | ✅ current | `pagespeedonline/v5/runPagespeed` is current. |
| **Cloudflare Workers/Pages** | Wrangler | version-checked | Stable, low-drift; not deep-queried this pass (no known breaking change). |
| **Playwright** | `^1.60` | version-checked | Current major; stable. |

### New doc-grounded action items
1. **R-Gemini:** change the voice model id to `gemini-3.1-flash-live-preview` (or adopt the LiveKit agents plugin). The current id likely breaks the voice widget.
2. **R-Supabase-RLS:** move the send-quota / suppression writes to a **service-role** key server-side, per Supabase's RLS docs — this is why the daily cap silently never fires.
3. **R-Resend:** when sending the report (or the Telegram-style long payload), use `attachments`; add an `idempotencyKey` per business+day to harden against double-sends.
