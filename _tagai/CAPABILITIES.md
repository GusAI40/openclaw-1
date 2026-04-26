# OpenClaw Capabilities — Local Inventory

Captured 2026-04-25, OpenClaw 2026.4.23 on Windows 11. Sources: `openclaw skills list`, `plugins list`, `channels list`, `channels capabilities --help`, `models list`, `models status`.

## Skills

`openclaw skills list` reports **31 ready / 70 total**. Sources: `openclaw-bundled` (built-in) and `agents-skills-personal` (user). All ready unless marked `△ needs setup`.

Ready (31):
- ⭐ agent-browser — snapshot-based browser automation CLI
- ⭐ audit-website — 21-category site health audit
- ⭐ coding-agent — delegate work to background Codex/Claude/Pi
- ⭐ docx, pdf, pptx, xlsx — Office/PDF document manipulation
- ⭐ frontend-design, shadcn, tailwind-design-system, ui-ux-pro-max, web-design-guidelines — frontend/UI suite
- ⭐ gemini — Gemini CLI
- ⭐ gh-issues, ⭐ github — GitHub issue + PR workflow via `gh`
- ⭐ healthcheck — host hardening audit
- next-best-practices, vercel-composition-patterns, vercel-react-best-practices — React/Next guidance
- ⭐ node-connect — diagnose OpenClaw node pairing
- ⭐ openai-whisper, ⭐ openai-whisper-api — local + API STT
- programmatic-seo, seo-audit — SEO at scale + manual diagnosis
- remotion-best-practices, ⭐ video-frames — video creation/extraction
- skill-creator — author/optimize skills
- taskflow, taskflow-inbox-triage — durable multi-step task coordination
- ⭐ webapp-testing — Playwright test scripts
- weather — forecasts

Needs setup (39): 1password, apple-notes, apple-reminders, bear-notes, blogwatcher, blucli, bluebubbles, camsnap, clawhub, discord, eightctl, gifgrep, gog (Google Workspace), goplaces, himalaya, imsg, mcporter, model-usage, nano-pdf, notion, obsidian, openhue, oracle, ordercli, peekaboo, sag (ElevenLabs), session-logs, sherpa-onnx-tts, slack, songsee, sonoscli, spotify-player, summarize, things-mac, tmux, trello, voice-call, wacli, xurl. Many are macOS-only (apple-*, peekaboo, things-mac, imsg, bluebubbles) or need external API keys.

## Plugins

`openclaw plugins list` **errored — hung indefinitely (90s timeout, exit 124)**, no output on stdout or stderr. Likely depends on the Gateway, which is not yet running (parallel agent is repairing via `doctor --fix`). Retry after gateway is up. Subcommands available per `--help`: list, install, marketplace, doctor, enable, disable, inspect, update, uninstall.

## Channels

`openclaw channels list` returns: `Chat channels:` (none) / `Auth providers (OAuth + API keys): - none`. **Zero channels configured.**

Supported provider catalog from `channels capabilities --help` (22 providers):
- ⭐ discord, ⭐ imessage, ⭐ slack, ⭐ telegram, ⭐ whatsapp, ⭐ signal
- bluebubbles, feishu, googlechat, irc, line, matrix, mattermost, msteams, nextcloud-talk, nostr, qqbot, synology-chat, tlon, twitch, zalo, zalouser

(No SMS/Gmail channel — handled via skills `himalaya`/`gog` instead.)

## Models

`openclaw models list` produced no output across multiple flag combinations (`--all`, `--json`, `--plain`, `--provider <id>`) — exit 0 but empty stdout. Likely empty until a provider is `models set`-configured. `openclaw models status` is the source of truth:

- **Default model:** `openai/gpt-5.5`
- Fallbacks: 0 configured · Image model: none · Aliases: 0 · Configured models: all

Auth profiles (env-loaded, all keys present):
- ⭐ anthropic (`ANTHROPIC_API_KEY`)
- anthropic-openai (proxy via Anthropic key)
- ⭐ openai (`OPENAI_API_KEY`)
- ⭐ openrouter (`OPENROUTER_API_KEY`) — gateway to many models
- deepseek, mistral, huggingface, perplexity, exa, tavily, brave, firecrawl, deepgram, elevenlabs

OAuth/token-bound providers: none.

## Notes

- **Skill totals**: 70 discovered, 31 ready. Heavy bias toward macOS skills that won't run here; the 31 ready cover the active TAG AI surface (web automation, code, docs, decks, video, design, GitHub).
- **Plugins command hangs** — capture later once gateway is healthy; right now the file system / marketplace probe never returns. Treat as `unknown` for the inventory.
- **Models list is empty** even with `--all`; `models status` is the real inventory and shows 14 provider keys live via env (master `~/.env`).
- **No channels and no OAuth tokens** are wired yet — onboarding step (per `ONBOARD_PLAYBOOK.md`) hasn't been executed.
- Default model `openai/gpt-5.5`; no fallbacks, no image model — agents fail closed if OpenAI is rate-limited until fallbacks are set.
