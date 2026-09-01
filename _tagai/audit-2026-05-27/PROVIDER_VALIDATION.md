# Provider Validation — 2026-05-27

**How this was checked:** live docs (WebFetch) and live runtime evidence (Hetzner logs from 2026-05-27). Anything not validated has an honest "deferred" or "could not reach" note. **No memory-based guessing.**

---

## Providers in active use (validated)

### 1. DeepSeek (primary LLM)

- **Used as:** `deepseek/deepseek-v4-flash` (both tenants, set in `openclaw.json:agents.defaults.model.primary`).
- **Docs checked:** https://api-docs.deepseek.com/quick_start/pricing — verified 2026-05-27.
- **Findings:**
  - `deepseek-v4-flash` ✅ exists, 1M-token context, non-thinking + thinking modes.
  - Pricing: $0.14 / 1M input (cache miss), $0.28 / 1M output. Cache-hit input is $0.0028 / 1M.
  - Base URL: `https://api.deepseek.com`.
  - `deepseek-chat` and `deepseek-reasoner` are legacy aliases scheduled for deprecation.
- **Runtime evidence:** Gus's main and Julian's tenant both booted with `agent model: deepseek/deepseek-v4-flash` after the 2026-05-22 fix.
- **Live concern:** Gus account balance was $1.92 as of 2026-05-22. At $0.42 / 1M cumulative, that's roughly 4.5M tokens of runway. Top up.

### 2. Anthropic (LLM fallback)

- **Used as:** `anthropic/claude-haiku-4-5` and `anthropic/claude-sonnet-4-6` in Julian's fallback list. **Gus main has DOTTED versions** (`claude-haiku-4.5`, `claude-sonnet-4.6`) — these are NOT valid IDs.
- **Docs checked:** https://platform.claude.com/docs/en/docs/about-claude/models/overview (2026-05-27 redirect from docs.anthropic.com).
- **Findings:**
  - Valid model IDs (current generation): `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`). **Dashes only.** Dotted forms like `claude-haiku-4.5` are **rejected**.
  - Pricing (per 1M tokens): Opus 4.7 = $5 / $25 in/out. Sonnet 4.6 = $3 / $15. Haiku 4.5 = $1 / $5.
  - Deprecation note: `claude-sonnet-4-20250514`, `claude-opus-4-20250514` retiring 2026-06-15.
- **Verdict:**
  - Julian fallback chain: ✅ valid.
  - Gus main fallback chain: ❌ **BROKEN** — Anthropic will 400-error on every call.
- **Action:** see Risk R-1.

### 3. Google AI (LLM fallback + image generation)

- **Used as:**
  - LLM fallback: `google/gemini-2.5-flash-lite` (both tenants).
  - Image generation: `google/gemini-3.1-flash-image-preview` (Julian's session today, before key expired).
- **Docs checked:** **deferred — not fetched in this audit.** Confirmed model names by live runtime evidence only (the runtime accepted both IDs before billing/key issues).
- **Runtime evidence (2026-05-27, Julian's session):**
  ```
  [image-generation] candidate failed: google/gemini-3.1-flash-image-preview:
  Google image generation failed (HTTP 400): API key expired. Please renew the API key.
  ```
- **Verdict:** Model ID accepted by the API; **API key has expired** (HTTP 400 INVALID_ARGUMENT today). Rotate.
- **Action:** see Risk R-13.

### 4. OpenAI (image generation candidate in the fallback chain)

- **Used as:** `openai/gpt-image-2` (Julian's image-gen fallback when Google fails).
- **Docs checked:** **deferred** — not fetched.
- **Runtime evidence (2026-05-27, Julian's session):**
  ```
  [image-generation] candidate failed: openai/gpt-image-2:
  OpenAI image generation failed (HTTP 400): Billing hard limit has been reached.
  ```
- **Verdict:** Model ID valid; **billing hard limit hit today**. Either raise the limit or remove from the fallback chain.
- **Action:** see Risk R-13.

### 5. Kie.ai (video + image aggregator)

- **Used as:** `veo3_fast` (Google Veo 3.1 Fast through Kie) — Julian generated multiple blueprint hero videos today via this path.
- **Docs checked:** https://docs.kie.ai/ — base URL confirmed, **but the specific model-list page (`/veo3-api/getting-started`) returned 404** as of 2026-05-27. Could not validate the exact model identifier from public docs.
- **Runtime evidence:** Julian's session 2026-05-27 successfully launched task `3a9f5bd292e35d7c5becd1d1ebb8595a` and polled it to completion using `veo3_fast`. So the model ID **works in production** today.
- **Verdict:** ✅ working, ❌ docs are sparse / 404'd. **Validated by runtime, not by docs.**
- **Action:** when the Kie API changes, runtime breaks first — keep an eye on it.

### 6. Telegram Bot API (founders' inbound channel)

- **Used as:** long-poll via Bot API for both tenants.
- **Docs checked:** https://core.telegram.org/bots/api — 2026-05-27.
- **Findings:**
  - `getUpdates` parameters: `offset`, `limit` (1-100), `timeout` (long-poll seconds), `allowed_updates`.
  - "An update is considered confirmed as soon as getUpdates is called with an offset higher than its update_id" — current runtime stores this in `telegram/update-offset-default.json` per tenant. ✅ matches docs.
- **Concurrency note (NOT in docs, but TAG ground truth):** two pollers on the same token cause HTTP 409 "duplicate poller." Tracked in the 2026-05-22 session log as a footgun (Claude's own `curl getUpdates` probes during diagnosis caused this).
- **Verdict:** ✅ wired correctly. Bot identity confirmed today: `@JujuJarvis_bot` (Julian, id 8763635904).

### 7. Cloudflare Pages (Julian's deploy target)

- **Used as:** Julian deployed `rescue-websites.pages.dev` today via `wrangler` direct upload (no git source configured).
- **Docs checked:** **deferred.**
- **Runtime evidence:** Julian's session 2026-05-27 deployment URL `https://b6201abb.rescue-websites.pages.dev` returned `success`. `wrangler pages project list` confirmed: "No git source configured." Project is **upload-only**, no auto-build on push.
- **Verdict:** Working but **upload-only**. Future deploys must run `wrangler pages deploy` manually — `git push` to GitHub does NOT trigger a build on this project.
- **Action:** if auto-build matters, connect the Pages project to a GitHub repo. Otherwise, document that this is intentional.

### 8. Microsoft Graph (MCP)

- **Used as:** `mcp-servers/microsoft-graph/` — Entra ID client-credentials, 6 tools (mail_search, mail_send, calendar_list_events, calendar_create_event, drive_list, drive_get_file).
- **Docs checked:** **deferred** in this audit. Skill `setup-google-workspace` and `_tagai/smoke-test-msgraph.sh` exist for verification.
- **Verdict:** **configured for Gus, currently broken for Julian** — Julian's `openclaw.json` references MCP servers but the program files don't exist under `/home/tagai/tenants/julian/.openclaw/mcp-servers/`. See Risk R-10.

### 9. Supabase (data layer)

- **Used as:** shared across tenants — exactly the design problem `rescue-websites-sim` is built to surface (two tenants double-emailing the same business via shared deduplication scope).
- **Docs checked:** **deferred.**
- **Runtime evidence:** referenced via `mcp__supabase__*` in agent profiles and the live rescue-websites pipeline.
- **Verdict:** in use, but the **tenant-isolation migration is proposed-not-applied**. See Risk R-9.

### 10. Resend (transactional email)

- **Used as:** outbound email for the live rescue-websites pipeline; mocked in `rescue-websites-sim`.
- **Docs checked:** **deferred.** Reference snippet at `_tagai/resend.json`.
- **Runtime evidence:** active use confirmed by skills (`copper-send`, `spectrum-send`).
- **Verdict:** shared sender domain `ubntag.com` — this is the "reputation burn" risk the sim is built to surface. See Risk R-9.

---

## Summary table

| Provider | Live docs validated | Live runtime evidence | TAG verdict |
|---|---|---|---|
| DeepSeek | ✅ | ✅ booting today | OK, balance low |
| Anthropic | ✅ (dashes only) | ✅ both tenants | OK (R-1 fixed 05-28) |
| Google AI (Gemini image) | ✅ docs 05-28 | ✅ key rotated, GA model 200 | OK — `gemini-3.1-flash-image` fallback |
| Google Veo 3.1 | ✅ docs + pricing 05-28 | ✅ real 4s MP4 rendered via runtime | OK — `veo-3.1-fast` primary video ($0.12/s 1080p) |
| OpenAI | ✅ web 05-28 | ✅ real PNG via runtime | OK — `gpt-image-2` primary image |
| Kie.ai | ⚠ docs 404'd | ✅ Veo 3.1 Fast worked | OK — secondary video path |
| Telegram | ✅ | ✅ both tenants polling | OK |
| Cloudflare Pages | ❌ deferred | ✅ deploy succeeded today | OK, upload-only by design |
| Microsoft Graph | ❌ deferred | ⚠ broken for Julian | **R-10 medium** |
| Supabase | ❌ deferred | ✅ in use | OK, isolation migration pending |
| Resend | ❌ deferred | ✅ in use | shared-domain risk, sim flags it |

---

## What I did NOT validate (honest gaps)

1. Google AI Gemini docs — did not WebFetch model list.
2. OpenAI docs — did not WebFetch model list.
3. Cloudflare Pages docs.
4. Microsoft Graph docs.
5. Supabase + Resend docs.
6. The 100+ providers wired into upstream `extensions/` — out of scope (upstream's job).

These are deferred because (a) they aren't currently the source of an active fire and (b) the audit was scoped to a single working session. Add them to the next audit cycle.
