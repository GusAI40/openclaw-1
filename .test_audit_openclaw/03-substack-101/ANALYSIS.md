# OpenClaw 101 (Substack) — Analysis

_Source: `article.md` (21KB extracted from 202KB HTML)_  
_URL: https://sidsaladi.substack.com/p/openclaw-101-2026-march-29-the-complete_  
_Author: Sid Saladi · Publish date: March 29, 2026_

## Paywall status
**PAYWALLED.** Cuts off mid-section "Core Features Walkthrough" at the line: *"Continue reading this post for free, courtesy of Sid Saladi."* Parts 2–4 (Personal Workflow, 75+ Use Cases, Limitations) **were not extractable** without authentication.

## Confirmed contents (above the paywall)
- Framework intro + naming journey (Clawd → Moltbot → OpenClaw)
- Core architecture overview (gateway, agents, channels, tools, memory)
- Recommended **happy-path setup**, steps 1–7 (rest paywalled)
- **The "ClawHavoc" attack** is referenced as the security stress-test that drove the VirusTotal partnership and the broader hardening sprint

## Sid's recommended happy path (steps 1–7 confirmed visible)
1. Install OpenClaw (installer or Docker)
2. Run wizard / onboarding
3. Configure first channel (Telegram is the canonical pick — matches your current setup)
4. Pick a low-cost provider (DeepSeek = explicit recommendation — also matches your setup)
5. Configure persistent memory (HONCHO / QMD layer)
6. Add starter skills (Tavily search, Notion, Gmail are the named picks)
7. Set up first cron / standing-order (e.g., daily digest)

**Steps 8+ are paywalled** but, per the marketing analyst's read, include security hardening (Docker `--read-only --cap-drop=ALL`, gateway bound to 127.0.0.1, Skill Vetter) and more advanced workflow patterns.

## Where YOUR current setup matches Sid's path
- ✅ Step 1 install (Hetzner)
- ✅ Step 2 wizard ran
- ✅ Step 3 Telegram channel (only one wired)
- ✅ Step 4 DeepSeek-V4-Flash (95.4% cache hit, $2.40 spent)
- ⚠️ Step 5 Persistent memory — **not explicitly verified in screenshots** (gap)
- ❌ Step 6 starter skills — 57 installed but **only 9 ready, 48 need setup**
- ✅ Step 7 cron — `morning-digest` runs at 7:00 AM CT to Telegram

## Gaps Sid would flag
- **Skill enablement** — 48 of 57 skills are listed but never finished setup. Sid's 101 emphasizes Tavily/Notion/Gmail as the must-have starter set. Are they in the 9 ready or the 48 idle?
- **Memory subsystem visibility** — Honcho / QMD memory layer status not visible in the 25 current-state screenshots. Sid's step 5 is foundational; if it's off, recall across sessions degrades.
- **Skill Vetter** (paywalled but referenced) — local pre-install scan in addition to ClawHub's VirusTotal scan.

## Atomic capabilities Sid mentions in the visible portion
- 24+ channels named (matches homepage)
- DeepSeek + Claude-Max-API-Proxy + Ollama as the three "tier" providers
- Honcho-style persistent memory
- Standing orders, cron jobs, taskflow as the three automation primitives
- ClawHub skill marketplace
- Multi-agent delegation
- Voice-wake nodes
- Web-fetch, browser, code-exec as the "big three" power tools
- macOS native integration (menu-bar, voicewake, peekaboo) — not relevant to Hetzner deploy
- iMessage via BlueBubbles bridge
- Discord/Slack as enterprise picks
- Twitch + Google Chat as the rebrand-day additions
- Plugin SDK with entrypoints + subpaths
- Skill creator skill
- Sandboxing modes (Docker hardening)
- Token gateway auth + allowlist exec
- Device auth + paired operator devices

## Verbatim quotes worth preserving (visible portion)
> "Your assistant. Your machine. Your rules."

> "OpenClaw is an open agent platform that runs on your machine and works from the chat apps you already use."

> "The lobster has molted into its final form."

## What we'd need to unlock the full article
A paid Substack subscription to Sid Saladi, OR a paste of the full article text, OR running the article through a paywall-bypass via the user's own login.
