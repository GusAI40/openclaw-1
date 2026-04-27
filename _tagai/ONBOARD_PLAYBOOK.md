# Jarvis AI Onboard Playbook

> Jarvis AI (the OpenClaw fork). The `openclaw` CLI command and config paths stay upstream-named for clean rebases.

**Run as `tagai` user on the Hetzner VPS:**
```bash
sudo -iu tagai
cd ~  # ensures openclaw.json lands in /home/tagai/.openclaw/
openclaw onboard --install-daemon
```

Reverse-engineered from `src/wizard/setup.ts`, `docs/start/wizard.md`, and `docs/start/wizard-cli-reference.md`. Prompts appear in this order. Use `--accept-risk` if you want to skip the security confirmation; otherwise answer "yes" once at the top.

---

## Prompt-by-prompt

### 1. Security risk acknowledgement
- **Question:** "I understand the security implications of running an AI agent that controls my system." (confirm yes/no)
- **Recommended answer:** **Yes**
- **Why:** Jarvis AI can read/write your workspace and call tools. The Hetzner VPS is Gus-only, isolated from his laptop, so the blast radius is contained. Pass `--accept-risk` in scripted reruns.

### 2. Setup mode
- **Question:** "Setup mode" → QuickStart vs Manual (Advanced).
- **Recommended answer:** **QuickStart**
- **Why:** QuickStart writes sane defaults: loopback gateway on port 18789, auto-generated token, `tools.profile: "coding"`, `session.dmScope: "per-channel-peer"`, Telegram + WhatsApp DM allowlist. Faster, fewer footguns. We can override anything later with `openclaw configure`.

### 3. Existing config handling (only appears if `~/.openclaw/openclaw.json` exists)
- **Question:** "Config handling" → Use existing values / Update values / Reset.
- **Recommended answer:** **Use existing values** on a fresh box; **Update values** if rerunning to add a channel; **Reset** only if state is corrupted.
- **Why:** Re-running onboard never wipes state unless you pick Reset.

### 4. Local vs Remote gateway (Manual flow only — QuickStart skips this and chooses Local)
- **Question:** "What do you want to set up?" → Local gateway (this machine) / Remote gateway (info-only).
- **Recommended answer:** **Local gateway** (the Hetzner VPS *is* the gateway).
- **Why:** Remote mode is for laptops connecting to a gateway elsewhere. The VPS hosts the gateway.

### 5. Workspace directory (Manual only; QuickStart uses default)
- **Question:** "Workspace directory"
- **Recommended answer:** `~/.openclaw/workspace` (default — resolves to `/home/tagai/.openclaw/workspace`)
- **Why:** Matches Hetzner persistence convention. Aligns with `_tagai/docker-compose.tagai.yml` volume mounts if we move to containerized deploy later.

### 6. Model / auth provider
- **Question:** Auth choice picker (Anthropic Claude CLI / Anthropic API key / OpenAI Codex OAuth / OpenAI API key / xAI / OpenCode / Vercel AI Gateway / Cloudflare AI Gateway / MiniMax / StepFun / Synthetic / Ollama / Moonshot / Custom / Skip).
- **Recommended answer:** **Anthropic API key**
- **Why:** TAG's master `~/.env` already has `ANTHROPIC_API_KEY`. Onboard auto-detects it. Anthropic Claude CLI works locally on Gus's laptop but adds a daemon dependency on a VPS. API key is the recommended production path per upstream docs.
- **Action:** Pre-set `export ANTHROPIC_API_KEY=...` from `/home/tagai/.tagai-env` *before* running onboard, or paste when prompted. Use `--secret-input-mode ref --gateway-token-ref-env ANTHROPIC_API_KEY` if we want env-backed refs instead of plaintext in `auth-profiles.json`.

### 7. Default model picker
- **Question:** "Default model" — list filtered to chosen provider.
- **Recommended answer:** **claude-opus-4-7** (or current latest Opus per `agent-techniques.md` — strongest model = hardest to prompt-inject when running webhook content).
- **Why:** Onboard explicitly recommends "strongest latest-generation model" when the agent processes webhook content. WhatsApp/Telegram inbound qualifies.

### 8. Gateway port
- **Question:** "Gateway port"
- **Recommended answer:** **18789** (QuickStart default)
- **Why:** Matches the upstream default; matches docs and clients. Bind to loopback on Hetzner; expose via SSH tunnel from Gus's laptop, not by opening the port publicly.

### 9. Gateway bind address (Manual only)
- **Question:** "Gateway bind" → loopback / lan / auto / custom / tailnet
- **Recommended answer:** **loopback** (or **tailnet** if Gus puts the VPS on his Tailscale network)
- **Why:** No public exposure. Tailnet is the clean way to reach it from Gus's laptop and phone (OpenClaw mobile app supports tailnet hosts).

### 10. Gateway auth mode
- **Question:** Token vs Password; then "Generate/store plaintext token" vs "Use SecretRef".
- **Recommended answer:** **Token, generate plaintext** for QuickStart; or **SecretRef → env var `OPENCLAW_GATEWAY_TOKEN`** for the production hardened path.
- **Why:** Even on loopback, token auth prevents any local process from connecting unauthenticated. SecretRef keeps the token out of `openclaw.json` and lets Gus rotate via `.tagai-env`. The env var stays `OPENCLAW_GATEWAY_TOKEN` because that's the upstream-defined name.

### 11. Tailscale exposure
- **Question:** "Tailscale exposure" → Off / Serve / Funnel
- **Recommended answer:** **Off** initially. Switch to **Serve** later if Gus joins the VPS to his tailnet.
- **Why:** Tailscale Serve gives clean tailnet-only access from his phone. Funnel exposes publicly — never needed.

### 12. Channels
- **Question:** "Channels to enable" → multi-select (BlueBubbles, Discord, Feishu, Google Chat, Mattermost, Microsoft Teams, QQ Bot, Signal, Slack, Telegram, WhatsApp, …).
- **Recommended answer:** **WhatsApp + Telegram only** at onboard time.
- **Why:** Tier 1 from `CHANNEL_STRATEGY.md`. Slack added via `openclaw channels add --channel slack` later when first Slack client onboards. Selecting fewer channels = fewer plugin installs = faster onboard.
- **Sub-prompts triggered:**
  - **WhatsApp**: "Install `@openclaw/whatsapp` plugin?" → **Yes** (plugin is upstream-named). Then prompts for phone number for `allowFrom` allowlist → enter Gus's E.164 number (e.g., `+18175551234`).
  - **WhatsApp**: QR login can be deferred — say no at onboard, run `openclaw channels login --channel whatsapp` separately so Gus has time to grab his phone.
  - **Telegram**: "Bot token" → paste from BotFather (or set `TELEGRAM_BOT_TOKEN` in env first). Then "Allowlist user ID" → numeric ID from @userinfobot.

### 13. Daemon install
- **Question:** "Install daemon?" → systemd user unit on Linux.
- **Recommended answer:** **Yes** (passed automatically via `--install-daemon` flag).
- **Why:** Always-on is the whole point. Onboard auto-runs `loginctl enable-linger tagai` so the gateway survives logout. May prompt for sudo — allow it.
- **Runtime selection:** Pick **Node** (required for WhatsApp + Telegram; Bun is incompatible).

### 14. Health check
- **Question:** none — automatic; "Start gateway and verify?"
- **Recommended answer:** **Yes**
- **Why:** Catches misconfig before you walk away. Runs `openclaw health` internally.

### 15. Skills setup
- **Question:** "Install recommended skills?" + "Node manager: npm / pnpm / bun"
- **Recommended answer:** **Yes**, **pnpm**
- **Why:** Upstream repo uses pnpm (see `pnpm-workspace.yaml`). Stay consistent. Bun is flagged unstable for this codebase.

### 16. Web search provider
- **Question:** "Web search provider" → Brave / DuckDuckGo / Exa / Firecrawl / Gemini / Grok / Kimi / MiniMax / Ollama / Perplexity / SearXNG / Tavily.
- **Recommended answer:** **Brave** (Gus has `BRAVE_API_KEY` in TAG's audited keys); fallback **DuckDuckGo** (key-free).
- **Why:** Brave is solid + already paid for. Skip if you want — re-run via `openclaw configure --section web` later.

### 17. Finish
- Onboard prints summary + next steps. Daemon should be running.

---

## After onboard

```bash
# Verify daemon is up
systemctl --user status openclaw-gateway

# Live health probe (channel checks included)
openclaw status --deep
openclaw doctor

# Pair WhatsApp (only if deferred at step 12)
openclaw channels login --channel whatsapp --account personal
# Scan QR with phone: WhatsApp → Settings → Linked Devices → Link a Device

# First DM from Gus's phone, then approve the pairing code
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <CODE>

# Same for Telegram (DM the bot from Gus's account first)
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>

# Lock down the .tagai-env permissions
chmod 600 /home/tagai/.tagai-env
ls -l /home/tagai/.openclaw/credentials/whatsapp/personal/creds.json   # should be 600

# Optional: verify gateway from Gus's laptop via SSH tunnel
# (run on laptop)  ssh -L 18789:127.0.0.1:18789 tagai@<vps-ip>
# then point OpenClaw mobile/desktop client at ws://127.0.0.1:18789
```

## Unknowns (verify on first interactive run, then update this doc)

The exact wording of these prompts could not be 100% confirmed from the source — fill in on first real run:

1. The auth-choice picker label text (we have the value list but not the literal screen labels).
2. The channels multi-select widget — confirms whether sub-prompts (WhatsApp phone, Telegram bot token) appear inline during onboard or are deferred.
3. The web search provider step's exact position — wizard reference lists it but `setup.ts` import order may move it.
