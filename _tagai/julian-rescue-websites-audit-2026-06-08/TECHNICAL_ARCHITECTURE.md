# Technical Architecture — Julian rescue-websites — 2026-06-08

Read first-hand from `package.json`, `src/lib/env.ts`, `src/pipeline.ts`, `src/audit/audit.ts`, `src/lib/verticals.ts`.

## Stack
- **Language/runtime:** TypeScript run via `tsx` (no build step for scripts). Node 22 types.
- **Package manager:** npm (`package-lock.json`).
- **Data:** Supabase (`@supabase/supabase-js ^2`, schema in `src/lib/supabase-schema.sql`).
- **Hosting of demos:** Cloudflare Pages + Workers (Wrangler).
- **Email:** Resend `^4`.
- **Discovery:** Google Places API.
- **Audit:** Google PageSpeed Insights v5 + Firecrawl v1 + Playwright.
- **Voice:** LiveKit `^2` + Gemini via a Cloudflare Worker proxy.
- **Templating:** Handlebars (demo-site generation).

## Entry points (npm scripts)
| Script | Runs | Purpose |
|---|---|---|
| `pipeline` | `src/pipeline.ts` | full run: discover → audit → mockup → deploy → report → email |
| `pipeline:dry` | same, dry-run | no emails sent; safe to test |
| `discover` | `src/discover/discover.ts` | step 1 only |
| `audit` | `src/audit/audit.ts` | step 2 only |
| `report` | `src/audit/report.ts` | report generation |
| `email` | `src/outreach/email.ts` | outreach send |
| `migrate` | Supabase migration | schema apply |
| `test`, `test:scoring`, `test:templates`, `test:services` | test runners | unit checks |

## The pipeline (`src/pipeline.ts`) — actual control flow
Logs `[1/4]`→`[4/4]` plus a step 0:
1. **Step 0 — wake snoozes:** `wakeReadySnoozes()` flips ready `snoozed` leads back to `report_generated` so outreach retries.
2. **[1/4] Discover:** `discoverBusinesses({ lat, lng, radiusMiles })` via Google Places.
3. **[2/4] Audit:** for each `discovered` business **with a website**, `auditWebsite()` runs; then `generateAllMockups()` (3 variants) or `generateMockup()`; then `uploadReport()`; then `deployReport()` to Cloudflare Pages for live URLs.
4. **[3/4] Report:** hosted report page (`getReportUrl`, `getAuditData`).
5. **[4/4] Email:** `extractContactEmail()` then `sendOutreachEmail()` via Resend, capped by `DAILY_SEND_CAP`.

Mockup failures are **non-fatal** (the run continues and the report still ships) — a good resilience choice.

## Scoring (the sales hook) — `src/audit/audit.ts`
- **Performance** from `getPageSpeed()` → `googleapis.com/pagespeedonline/v5/runPagespeed` (mobile + desktop): performance, accessibility, best-practices, SEO, plus LCP/INP/CLS.
- **Technical** from `calcTechnicalScore()`: starts at 100, deducts for missing SSL (-20), no sitemap (-10), no robots.txt (-5), broken links, missing meta titles/descriptions, missing H1s, missing alt text (capped deductions).
- Output is a graded site score (the "F/49/100" hook) that drives the outreach message.

> Note: an earlier (second-hand) review described a 6-axis AEO/GEO weighting. The scoring functions I read first-hand are **technical + PageSpeed/Lighthouse**. If AEO/GEO weighting exists it's elsewhere in `audit.ts`/`report.ts` and was not confirmed in this pass.

## Verticals (`src/lib/verticals.ts`) — first-hand
construction, landscaping, food-manufacturing, logistics, restaurants, education, healthcare, automotive. Each defines `placeTypes` and `textQueries` used by Google Places discovery. (This set differs from the older review's dentistry/HVAC/legal/medspa/roofing — the code has evolved.)

## Data model (Supabase)
Leads carry a **status lifecycle**: `discovered` → `report_generated` → `snoozed` → emailed, with snooze/wake logic to retry outreach without double-sending. Schema: `src/lib/supabase-schema.sql`. Key: `SUPABASE_ANON_KEY` (anon, least-privilege).

## Config contract (`src/lib/env.ts`)
Required: `FIRECRAWL_API_KEY`, `GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Optional: `PAGESPEED_API_KEY`, `CLOUDFLARE_API_TOKEN/ACCOUNT_ID`, `GEMINI_API_KEY`, `LIVEKIT_*`, `DAILY_SEND_CAP` (default 1000), `TENANT_ID` (default `gus`). Secrets load from gitignored `.env.local` first, then `.env`.

## Self-running layer
`src/god-mode/daemon.ts` (+ `start.sh`) is a PID-based daemon that runs the pipeline on a daily schedule — the thing that makes this a hands-off lead engine.
