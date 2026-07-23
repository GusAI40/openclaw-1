# Risk Register — Julian rescue-websites — 2026-06-08

Severity: **Critical** (breaks prod / exposes secrets / blocks revenue) · **High** (user-visible failure) · **Medium** (tech debt / drift) · **Low** (polish).

| # | Issue | File / Area | Severity | Why it matters | Recommended fix |
|---|---|---|---|---|---|
| J-1 | **Code lived only in ephemeral container layer, unpushed** | `/home/node/rescue-websites` | **Critical → RESOLVED 2026-06-08** | A container recreate would have wiped ~2 weeks of work; nothing was on GitHub or backup | Done: pushed to GitHub + host backup copy. See `JULIAN_WORK_RECOVERY.md` |
| J-2 | **Exposed GitHub PAT(s)** | repo remote URL embeds a token; a token was pasted in chat | **Critical** | Anyone with the remote URL or logs can push to his repo | Rotate the token(s); set the remote to a clean URL without an embedded token (handled separately) |
| J-3 | **Shared sender domain reputation** | `src/lib/env.ts` `RESEND_FROM=julian@ubntag.com` | **High** | One bad cold blast can torch deliverability for E-Rate / Spectrum / copper-send too | Give cold outreach its own subdomain/domain. `DAILY_SEND_CAP=1000` helps but doesn't isolate blast radius |
| J-4 | **Firecrawl v1 SDK (legacy)** | `package.json` `@mendable/firecrawl-js ^1.0.0` | **Medium** | One major version behind; v2 SDK exists; v1 may deprecate and blocks new features | Migrate to `firecrawl` v2 SDK (`scrapeUrl`→`scrape`, `crawlUrl`→`crawl`) |
| J-5 | **Legacy + new Google Places mix** | `src/discover/discover.ts` (`maps.googleapis.com` + `places.googleapis.com`) | **Medium** | Legacy Places is being sunset; a silent discovery outage dries the funnel | Confirm which `maps.googleapis.com` calls are legacy Places vs geocoding; migrate legacy Places to the New API |
| J-6 | **Gemini + PageSpeed keys unrestricted** | `GEMINI_API_KEY`, `PAGESPEED_API_KEY` | **Medium** | Google auto-blocks unrestricted keys past its deadline (already bit the shared Gemini key) | Restrict each key to its specific API before the deadline |
| J-7 | **Single daemon, no health alert** | `src/god-mode/daemon.ts` | **Medium** | Crashed once this session; a silent death stops all lead-gen with no page | Add a heartbeat + a "0 leads today" alarm |
| J-8 | **Scratch scripts litter the repo root** | `build-blueprint.js`, `fix-*.js`, `patch_report.*` (untracked) | **Low** | Confuses future readers; some are dead one-offs | Move to a `scratch/` dir or delete; he already untracks them (good instinct) |
| J-9 | **Duplicate/parallel template engines** | `audit/template-engine.ts` + `template-engine.fixed.ts` | **Low** | Two versions of the same thing invites editing the wrong one | Pick the live one, delete the other, leave a comment |
| J-10 | **`TENANT_ID` defaults to `gus`** | `src/lib/env.ts` | **Low** | A misconfigured run could write under the wrong tenant in Supabase | Default to empty and require it, or default to `julian` for his repo |
| J-11 | **No automated test coverage of the money path** | `test:*` scripts exist for scoring/templates/services | **Low/Medium** | Discovery → audit → email is the revenue path; a break there is silent | Add one end-to-end dry-run test that asserts a lead flows discover→report without sending |

## Rollup
| Severity | Open | Resolved today |
|---|---|---|
| Critical | J-2 (token rotation) | J-1 (work secured) |
| High | J-3 (shared sender domain) | — |
| Medium | J-4, J-5, J-6, J-7 | — |
| Low | J-8, J-9, J-10, J-11 | — |

## Highest-leverage next 3
1. **J-2** — rotate the exposed tokens (security, do first).
2. **J-3** — isolate Julian's cold outreach onto its own sending domain (protects all of TAG's email revenue).
3. **J-4 / J-5** — clear the Firecrawl v1 and legacy-Places drift before either causes a silent funnel outage.
