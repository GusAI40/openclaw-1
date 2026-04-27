# Jarvis AI Onboard Runbook (Server-Aware) — 2026-04-26

> Jarvis AI (the OpenClaw fork). The CLI binary, container names, and config paths stay upstream (`openclaw*`) for clean rebases. Brand layer is rebranded; tooling is not.

Server-aware, prompt-by-prompt instructions for taking the deployed Jarvis AI
gateway on `tagai-cloud` from "running but unconfigured" to "useful". Written from
live probes against the running container, NOT reverse-engineered from source.

## Current state (probed 2026-04-26 12:55 CDT)

- **Domain:** `https://openclaw.ubntag.com` — HEALTHY end-to-end (`/healthz` returns `{"ok":true,"status":"live"}`).
- **Reverse proxy:** Caddy v2.11.2 on host. Already routes correctly. Do NOT touch.
- **Containers:**
  - `openclaw-openclaw-gateway-1` — UP, healthy (17h+). (Container name keeps upstream identity.)
  - `openclaw-openclaw-cli-1` — UP, **HEALTHY** (was unhealthy earlier today; parallel agent P3.A fixed it).
- **CLI version inside container:** `openclaw 2026.4.25`.
- **Anthropic auth:** ALREADY CONFIGURED via `ANTHROPIC_API_KEY` env var. `openclaw models status` shows `claude-cli` provider with profile=1 (api_key=1), source=`env: ANTHROPIC_API_KEY`. The earlier HEALTH.md "no Anthropic auth" finding is **stale** — it is now wired up through the container env.
- **Telegram:** ALREADY CONFIGURED. `openclaw doctor` reports `Telegram: ok (@tagai_jarvis_bot) (177ms)`. 1 active session ID `agent:main:telegram:default:direct:8603473262` (last seen 1123m ago).
- **Default model:** `deepseek/deepseek-v4-flash` with fallbacks `google/gemini-2.5-flash-lite`, `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-4.6`.
- **Other auth profiles loaded:** `anthropic`, `openai`, `google`, `deepseek`, `groq`, `mistral` — all api_key.
- **Skills:** 9 eligible, 48 missing requirements (mostly missing native deps — fixable later, not blocking).
- **Plugins:** 63 loaded, 1 imported, 44 disabled, 0 errors.
- **Workspace dir:** `/home/node/.openclaw/` (inside container, mounted from `/home/tagai/.openclaw/` on host).

## Goal

Get from "deployed and partially configured" → "Telegram answers respond, WhatsApp pairs, doctor is GREEN".

## Key insight: most of onboard is already done

A previous interactive `openclaw onboard` run (or `--non-interactive` invocation) clearly happened — auth profiles, agent workspace, Telegram config, gateway daemon are all in place. The only YELLOW items are:

1. State dir perms (`chmod 700 ~/.openclaw`) — one shell command.
2. 3 orphan transcript .jsonl files — `openclaw doctor --fix` cleans these.
3. WhatsApp / additional channels not paired.
4. `NODE_COMPILE_CACHE` env not set (cosmetic, perf only).

You probably do NOT need to re-run `openclaw onboard` at all unless you want to add channels.

## Three paths, pick one

### Path A — Just clean up doctor warnings (FASTEST: 2 minutes)

If you only need the YELLOW health to go GREEN and the gateway is already serving Claude responses fine:

```bash
ssh tagai-cloud
docker exec -it openclaw-openclaw-cli-1 bash
# Inside container:
chmod 700 ~/.openclaw
openclaw doctor --fix
openclaw doctor          # should now be all green
exit                     # leave container
exit                     # leave server
```

That's it. No onboard run needed. Anthropic auth is already wired, Telegram is already up, gateway is already healthy at `https://openclaw.ubntag.com`.

To verify Claude actually answers via the gateway:
```bash
ssh tagai-cloud
docker exec -it openclaw-openclaw-cli-1 openclaw chat
# A terminal UI should open. Type "say hi" and confirm a response comes back.
# Ctrl+C to exit.
```

### Path B — Add WhatsApp / Slack / new channels (MEDIUM: 10-15 min)

If Path A passes and now you want WhatsApp pairing:

```bash
ssh tagai-cloud
docker exec -it openclaw-openclaw-cli-1 bash
# Inside container:
openclaw channels login --channel whatsapp
# Follow QR prompt — scan from WhatsApp on your phone (Settings → Linked Devices → Link a device)
openclaw channels list   # verify whatsapp shows enabled
openclaw channels status --probe   # verify it can connect
```

For Slack:
```bash
openclaw channels add --channel slack --token xoxb-<bot-token>
```

For iMessage / SMS: requires more setup (see `_tagai/CHANNEL_STRATEGY.md` Tier 3) — not covered here.

### Path C — Full re-onboard (NUCLEAR: 20-30 min, only if Path A doesn't help)

Use this if `openclaw doctor --fix` reports persistent failures, or you suspect the
config got corrupted. This wipes state and re-runs the full flow.

```bash
ssh tagai-cloud
docker exec -it openclaw-openclaw-cli-1 bash
# Inside container:
openclaw onboard --reset --reset-scope config+creds+sessions
# Follow prompt-by-prompt (next section)
```

WARNING: `--reset` deletes `auth-profiles.json`. After reset, the
`ANTHROPIC_API_KEY` env var will re-seed the `anthropic`/`claude-cli` providers
on first launch, but Telegram and any other channels will need re-pairing.

## Path C: Prompt-by-prompt for `openclaw onboard`

Each prompt below has the **recommended answer** for THIS server (Hetzner,
Caddy, container deploy at `/home/tagai/openclaw`).

### 1. Mode prompt
```
? Onboard mode: (local | remote)
```
**Answer:** `local`. The container IS the host of the gateway. We are not
pairing back to a remote gateway — we ARE the server.

### 2. Flow prompt
```
? Onboard flow: (quickstart | advanced | manual)
```
**Answer:** `advanced`. Quickstart skips channel setup we want; manual makes
you fill out everything by hand.

### 3. Workspace dir
```
? Agent workspace directory: (default ~/.openclaw/workspace)
```
**Answer:** ACCEPT DEFAULT (press Enter). Inside the container that resolves to
`/home/node/.openclaw/workspace` which is mounted from
`/home/tagai/.openclaw/workspace` on the host. Do not change.

### 4. Daemon runtime
```
? Daemon runtime: (node | bun)
```
**Answer:** `node`. The image ships node; bun would require rebuild.

### 5. Install daemon?
```
? Install gateway service?
```
**Answer:** `no`. systemd user services are NOT available inside the
container (`doctor` confirms this). The gateway is launched by docker-compose,
not by systemd. Selecting yes will fail with "systemd user services
unavailable".

### 6. Gateway bind
```
? Gateway bind: (loopback | tailnet | lan | auto | custom)
```
**Answer:** `loopback`. Caddy on the host proxies `openclaw.ubntag.com` →
`localhost:18789`. We want the gateway listening only on 127.0.0.1 so the
public internet cannot bypass Caddy. **Do NOT pick `lan` or `auto`** — that
would expose the gateway directly on `0.0.0.0:18789` without Caddy's TLS.

### 7. Gateway port
```
? Gateway port: (default 18789)
```
**Answer:** ACCEPT DEFAULT (`18789`). Caddyfile is hard-coded to this port.
Changing it breaks the public URL.

### 8. Gateway auth
```
? Gateway auth: (token | password)
```
**Answer:** `token`. Tokens can be revoked via env var; passwords get pasted
into clients.

### 9. Gateway token
```
? Gateway token (or env ref)
```
**Answer:** Use a SecretRef pattern. Type the env var name `OPENCLAW_GATEWAY_TOKEN`
when offered, then export it from `/home/tagai/openclaw/.env` (already in
`docker-compose.tagai.yml` env_file). If the prompt insists on a literal value,
generate one: `openssl rand -hex 32` and paste. Save it to `.env` after.

### 10. Auth choice
```
? Auth: (custom-api-key | skip | claude-cli | codex-cli | anthropic-cli | ...)
```
**Answer:** `claude-cli`. The `ANTHROPIC_API_KEY` env var is already exposed
inside the container — `claude-cli` will pick it up automatically and not
prompt for re-entry. The synthetic plugin auth uses this key as `claude-cli`'s
backend.

If `claude-cli` prompts for an Anthropic OAuth login URL: copy the URL,
paste into a browser ON YOUR LAPTOP, complete the OAuth, then paste the
callback code back into the SSH session. The localhost callback will not be
reachable but the paste-back flow works.

If you want to skip Anthropic auth and only use cheap fallbacks
(deepseek/google), pick `skip` — auth profiles already loaded will keep
working.

> Branding note: the `claude-cli` provider name is upstream-defined. Do not rename it; agents reference it by string.

### 11. API keys (one prompt per provider it offers)
```
? Anthropic API key:
? OpenAI API Key:
? Gemini API key:
...
```
**Answer:** Press Enter to skip each one. They are already populated from
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` env
vars (verified in `models status` output). Re-typing them risks creating
duplicate profiles.

### 12. Secret input mode
```
? API key persistence: (plaintext | ref)
```
**Answer:** `ref`. Keys live in `/home/tagai/.tagai-env` and
`/home/tagai/openclaw/.env` already; storing them again as plaintext in
`auth-profiles.json` is a duplication and a leak surface.

### 13. Channels setup
```
? Set up chat channels now? (yes | no)
```
**Answer:** `yes` if you want to add WhatsApp now. Otherwise `no` — Telegram
is already configured (verified in `channels list`) and you can add others
later via `openclaw channels login --channel <name>`.

If yes, you'll get a Telegram token prompt. The existing `@tagai_jarvis_bot`
token is already in the env, so press Enter to keep it.

### 14. Tailscale
```
? Tailscale: (off | serve | funnel)
```
**Answer:** `off`. We use Caddy + Let's Encrypt, not Tailscale Funnel. We have
public DNS already.

### 15. Search provider setup
```
? Configure search provider? (yes | no)
```
**Answer:** `no` for now. We have Exa, Tavily, etc. wired separately into
JARVIS. OpenClaw search is a nice-to-have, not a blocker.

### 16. Skills setup
```
? Configure skills? (yes | no)
```
**Answer:** `no`. 48 skills need missing native deps — fixing those is a
separate phase, and skipping here doesn't break anything (9 eligible skills
will work).

### 17. Control UI / TUI prompts
```
? Configure Control UI / TUI?
```
**Answer:** `no`. Dashboard is at `https://openclaw.ubntag.com/` (already
working). TUI we run on demand via `openclaw chat`.

### 18. Final review
```
? Apply this configuration?
```
**Answer:** Review the summary. If anything looks wrong, hit `n` and re-run
with `--reset` to start over.

## Non-interactive equivalent (for re-runs / scripting)

Once you've done it once, re-run via flags only — no prompts:

```bash
docker exec -i openclaw-openclaw-cli-1 openclaw onboard \
  --non-interactive \
  --accept-risk \
  --mode local \
  --flow advanced \
  --auth-choice claude-cli \
  --workspace /home/node/.openclaw/workspace \
  --daemon-runtime node \
  --no-install-daemon \
  --gateway-bind loopback \
  --gateway-port 18789 \
  --gateway-auth token \
  --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN \
  --tailscale off \
  --secret-input-mode ref \
  --skip-skills \
  --skip-search \
  --skip-ui \
  --json
```

Add `--skip-channels` if you don't want to touch chat config. Use `--reset
--reset-scope config+creds+sessions` to nuke first.

## After onboard — verification

```bash
docker exec -it openclaw-openclaw-cli-1 openclaw doctor
# Expect: all green; specifically:
#  - Startup optimization: ok (or warnings about NODE_COMPILE_CACHE — cosmetic)
#  - State integrity: ok (after chmod 700 + --fix)
#  - Security: ok
#  - Skills: 9 eligible / 48 missing-deps (fine)
#  - Plugins: Loaded 63, Errors 0
#  - Telegram: ok (@tagai_jarvis_bot)

# End-to-end test from your laptop:
curl -s https://openclaw.ubntag.com/healthz
# Expect: {"ok":true,"status":"live"}

# Test a real Claude call through the gateway:
docker exec -it openclaw-openclaw-cli-1 openclaw chat
# In TUI: type "what model are you?" → expect a response from claude/deepseek
# Ctrl+C to exit
```

## Pair phone (optional, after onboard works)

```bash
docker exec -it openclaw-openclaw-cli-1 openclaw qr
# Scan QR code with the OpenClaw mobile app
# OR copy the pairing code shown and enter it manually
```

## Troubleshooting

### "container not running"
The CLI container restarted. Check:
```bash
docker ps | grep openclaw
docker logs openclaw-openclaw-cli-1 --tail 50
```
If health is FAILING, see `_tagai/CLI_HEALTH_INVESTIGATION.md` for the orphan-namespace fix (P3.A).

### Onboard URL prompt opens a localhost link
The Anthropic OAuth callback uses `http://localhost:<port>` — that won't reach inside the container over SSH. Two options:
- Copy the URL, paste into a browser on your laptop, complete OAuth, paste the auth CODE back into the SSH session (paste-back works fine).
- Or skip OAuth entirely: pick `claude-cli` auth choice, which uses the `ANTHROPIC_API_KEY` env var without OAuth.

### "systemd user services unavailable"
Expected inside container. Always answer `no` to "Install gateway service?" / always pass `--no-install-daemon`. The gateway is owned by docker-compose, not systemd.

### Onboard hangs at "channel pair WhatsApp"
Ctrl+C out, finish the rest of onboard, then run `openclaw channels login --channel whatsapp --verbose` separately. The QR rendering can be flaky inside an SSH session — try `--qr-format unicode` or `--qr-format text`.

### Doctor still reports orphan transcripts after `--fix`
The 3 .jsonl files in `~/.openclaw/agents/main/sessions/` are stale. Manually:
```bash
docker exec -it openclaw-openclaw-cli-1 bash
cd ~/.openclaw/agents/main/sessions
ls *.jsonl | while read f; do mv "$f" "$f.deleted.$(date +%s)"; done
exit
```

### "Mem 553Mi available" warning
The host is memory-tight (3.7Gi total, ~3.2Gi used). Adding new containers risks OOM. Fix is separate (add 2GB swap), not in scope here. Onboard itself is light.

### Caddyfile / TLS confusion
DON'T touch `/etc/caddy/Caddyfile` during onboard. Caddy is independent of OpenClaw and already routes correctly. Onboard's gateway-bind question is about the container's internal listener, not the public TLS endpoint.

## Time estimates

| Path | Time | What you get |
|---|---|---|
| A — Cleanup only | 2-3 min | Doctor green, existing channels work |
| B — Add channels | 10-15 min | + WhatsApp / Slack paired |
| C — Full re-onboard | 20-30 min | Fresh config from scratch (only if A fails) |

## Recommended starting point

**Path A.** The probe data shows Jarvis AI is already 95% configured. Auth
profiles are loaded, Telegram works, gateway is healthy, plugins compiled. The
HEALTH.md YELLOW about "no Anthropic auth" was stale — `models status`
confirms the env var is wiring `claude-cli` correctly.

Start with Path A. If `openclaw chat` actually returns Claude responses,
you're done — declare GREEN and move on to Tier 1 channels (WhatsApp via
Path B) when needed.

## Files referenced
- `_tagai/HEALTH.md` — earlier health snapshot (some findings now stale)
- `_tagai/HETZNER_PREFLIGHT.md` — server topology
- `_tagai/CADDY_AUDIT.md` — TLS / proxy config
- `_tagai/CLI_HEALTH_INVESTIGATION.md` — CLI health bug + fix (P3.A)
- `_tagai/CHANNEL_STRATEGY.md` — Tier 1/2/3 channel plan
- `_tagai/ONBOARD_PLAYBOOK.md` — original reverse-engineered playbook (now
  superseded by this server-aware version)
