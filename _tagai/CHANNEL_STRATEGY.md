# Jarvis AI Channel Strategy

> Jarvis AI (the OpenClaw fork) — TAG's deployed product. CLI command names (`openclaw ...`), env var prefixes (`OPENCLAW_*`), and config paths stay upstream-aligned for clean rebases. Brand changes are user-facing only.

Priority order is driven by Gus's daily comms patterns: WhatsApp is #1 personal channel, Telegram is the existing ops dashboard channel (cheap and bot-token simple), Slack covers a slice of TAG client comms, iMessage/Discord are situational. Gmail is not a built-in chat channel in Jarvis AI — handle email through agent skills, not as a channel.

## Tier 1 — Activate Day 1

### WhatsApp
- **Why it matters:** Gus's most-used channel for personal + family + some client touchpoints. Highest leverage for "always-on Jarvis."
- **Auth method:** QR pair via WhatsApp Web (Baileys library). No API token, no Meta Business approval required.
- **Setup steps (run on Hetzner as `tagai` user, after `openclaw onboard`):**
  ```
  openclaw plugins install @openclaw/whatsapp     # if not auto-installed during onboard
  openclaw channels add --channel whatsapp --account personal
  openclaw channels login --channel whatsapp --account personal
  # Scan the QR from Gus's phone (Settings → Linked Devices → Link a Device)
  openclaw gateway                                  # if not running as systemd unit
  openclaw pairing list whatsapp                    # see incoming pairing requests
  openclaw pairing approve whatsapp <CODE>
  ```
- **Where credentials live:**
  - Baileys session: `/home/tagai/.openclaw/credentials/whatsapp/personal/creds.json` (chmod 600, do NOT commit)
  - No secrets in `.tagai-env` for WhatsApp — session is the secret.
- **Risks / known limitations:**
  - Multi-device session can drop on long restarts; need supervised reconnect (Node runtime only — Bun is unsupported).
  - WhatsApp may flag a server-side "Linked Device" if the phone is offline for too long. Keep `dmPolicy: "allowlist"` with Gus's E.164 number and use `selfChatMode: true` to talk to yourself safely.
  - Recommend: separate WhatsApp number long-term; personal number works as fallback (`selfChatMode: true`).

### Telegram
- **Why it matters:** Gus already uses Telegram for ops dashboards/alerts. Bot-token setup is the cheapest, most reliable channel — no QR, no session loss, works headless out of the box.
- **Auth method:** Bot token from @BotFather.
- **Setup steps:**
  ```
  # On Telegram, message @BotFather → /newbot → save token
  # On Hetzner, append to /home/tagai/.tagai-env:
  echo "TELEGRAM_BOT_TOKEN=123456:abc..." >> /home/tagai/.tagai-env
  chmod 600 /home/tagai/.tagai-env
  # Restart gateway
  systemctl --user restart openclaw-gateway
  # Find your numeric Telegram user ID (use @userinfobot), then:
  openclaw pairing list telegram
  openclaw pairing approve telegram <CODE>     # after you DM the bot once
  ```
- **Where credentials live:** `TELEGRAM_BOT_TOKEN` in `/home/tagai/.tagai-env` (chmod 600). Or in `~/.openclaw/openclaw.json` under `channels.telegram.botToken` for the default account.
- **Risks / known limitations:**
  - Bot Privacy Mode is on by default — disable via BotFather `/setprivacy` if you want the bot to read all group messages, OR make it group admin.
  - For one-owner usage, prefer `dmPolicy: "allowlist"` with explicit numeric `allowFrom: [<gus_user_id>]` so policy is durable in config.

## Tier 2 — Activate Week 1

### Slack
- **Why it matters:** Some TAG clients live in Slack. Activate when first Slack-based client onboards.
- **Auth method:** Slack app (Socket Mode preferred — no public webhook needed). Two tokens: App Token (`xapp-...`) + Bot Token (`xoxb-...`).
- **Setup steps:**
  - Create app at api.slack.com/apps → "From manifest" → paste the upstream example manifest (in `docs/channels/slack.md`).
  - Generate App-Level Token with `connections:write`.
  - Install to workspace, copy Bot Token.
  - Add to `/home/tagai/.tagai-env`:
    ```
    SLACK_APP_TOKEN=xapp-...
    SLACK_BOT_TOKEN=xoxb-...
    ```
  - Restart gateway.
- **Where credentials live:** `/home/tagai/.tagai-env` (chmod 600).
- **Risks / known limitations:** Each client = potentially a separate Slack app + separate account namespace under `channels.slack.accounts.<id>`. Plan multi-account from day 1; do not reuse one bot across clients.

### Gmail — NOT a channel, handle via skill
Jarvis AI has no first-party Gmail chat channel. Treat email as a *tool/skill* for the agent (we already have `setup-google-workspace` skill). Do not block on this for Tier 2.

## Tier 3 — Activate as needed

**Discord** — Bot via Discord Developer Portal. Bot token + Privileged Intents (Message Content + Server Members). Useful for community/internal team chat; low priority for TAG revenue. Token goes in `.tagai-env` as `DISCORD_BOT_TOKEN`. Setup ~15 min.

**iMessage via BlueBubbles** — Requires a *macOS box running BlueBubbles server*. Hetzner is Linux, so this is impractical from the VPS unless Gus dedicates a Mac mini at home as the BlueBubbles bridge (server URL + password webhook back to Hetzner). Skip until Gus has a quiet always-on Mac. Legacy `imsg` path is Mac-only and being deprecated — do not use.

**Microsoft Teams** — Bundled plugin. Activate only if a TAG client requires Teams. Setup: Azure app registration + bot token. Add to `.tagai-env` as `TEAMS_*` keys.

**Signal** — Bundled `signal-cli` integration. Linked-device pairing, Java 21 dependency. Useful for high-privacy client comms; activate on demand.

## Skip / Not Recommended

- **WeChat / QQ Bot / Feishu / Zalo / Line / KakaoTalk** — China/APAC channels, no TAG use case.
- **IRC / Matrix / Mattermost / Nextcloud Talk / Synology Chat / Tlon / Nostr / Twitch** — niche or community channels; no current TAG client.
- **Legacy iMessage (`imsg`)** — being deprecated upstream; if iMessage is ever needed, use BlueBubbles instead.
- **Twilio WhatsApp** — not in the built-in channel registry. The only WhatsApp path is Baileys (Web). Don't try to wire a Twilio sender as a "channel."
