# OpenClaw Health Report — 2026-04-25

## Summary
YELLOW — `doctor --fix` ran clean (0 plugin errors, gateway token configured), but headless Claude CLI is OAuth-only and the OpenClaw auth profile (`anthropic:claude-cli`) is still missing; onboarding/login is required before agent runs will work.

## Bundled Plugin Status
| Plugin | Version | Status | Notes |
|---|---|---|---|
| acpx | 0.5.3 | installed | Not flagged in post-fix doctor; resolved by `--fix` |
| node-edge-tts | ^1.2.10 | installed | Not flagged in post-fix doctor; resolved by `--fix` |
| playwright-core | 1.59.1 | installed | Not flagged in post-fix doctor; resolved by `--fix` |
| Plugins (aggregate) | n/a | 59 loaded / 1 imported / 43 disabled / 0 errors | All bundled deps appear satisfied |

## Gateway Readiness
- Gateway token: **configured** (set during `--fix` run)
- Token auth is now default (including loopback)
- No port/daemon detail emitted by `doctor`; daemon not yet started
- Workspace: `~\.openclaw\workspace` (writable)
- OAuth credentials dir not present (`~\.openclaw\credentials`) — skipped; no WhatsApp/pairing channel active, so this is benign

## Outstanding Issues
- **OpenClaw auth profile missing**: `anthropic:claude-cli` not in `C:\Users\gsanc\.openclaw\agents\main\agent\auth-profiles.json`. Fix: `openclaw models auth login --provider anthropic --method cli --set-default` (or run onboarding).
- **Claude project dir not yet created** (`~\.claude\projects\C--Users-gsanc--openclaw-workspace`) — appears after first Claude CLI turn; benign until first run.
- **Skills**: 31 eligible, **39 missing requirements**, 0 blocked. Most likely external CLIs/SDKs not yet on PATH (e.g., gh, bq, etc.); not blocking core functionality.
- **Shell completion**: zsh cache was missing; `--fix` regenerated it. Note Windows shell here is bash/PowerShell — zsh path is harmless.
- **Recommended deep scan**: `openclaw security audit --deep`.

## Evidence
### `openclaw doctor --fix` output
```
┌  OpenClaw doctor
│
◇  Claude CLI
│  - Binary: ~\AppData\Roaming\npm\claude.
│  - Headless Claude auth: OK (oauth).
│  - OpenClaw auth profile: missing (anthropic:claude-cli) in
│    C:\Users\gsanc\.openclaw\agents\main\agent\auth-profiles.json.
│  - Workspace: ~\.openclaw\workspace (writable).
│  - Claude project dir:
│    ~\.claude\projects\C--Users-gsanc--openclaw-workspace (not created
│    yet; it appears after the first Claude CLI turn in this workspace).
│  - Fix: run openclaw models auth login --provider anthropic --method
│    cli --set-default.
│
◇  Gateway auth
│  Gateway auth is off or missing a token. Token auth is now the
│  recommended default (including loopback).
│
◇  Gateway auth
│  Gateway token configured.
│
◇  State integrity
│  - OAuth dir not present (~\.openclaw\credentials). Skipping create
│    because no WhatsApp/pairing channel config is active.
│
◇  Security
│  - No channel security warnings detected.
│  - Run: openclaw security audit --deep
│
◇  Skills status
│  Eligible: 31
│  Missing requirements: 39
│  Blocked by allowlist: 0
│
◇  Plugins
│  Loaded: 59
│  Imported: 1
│  Disabled: 43
│  Errors: 0
│
◇  Shell completion
│  Shell completion is configured in your zsh profile but the cache is
│  missing.
│  Regenerating cache...
```

### `openclaw doctor` (post-fix) output
```
┌  OpenClaw doctor
│
◇  Claude CLI
│  - Binary: ~\AppData\Roaming\npm\claude.
│  - Headless Claude auth: OK (oauth).
│  - OpenClaw auth profile: missing (anthropic:claude-cli) in
│    C:\Users\gsanc\.openclaw\agents\main\agent\auth-profiles.json.
│  - Workspace: ~\.openclaw\workspace (writable).
│  - Claude project dir:
│    ~\.claude\projects\C--Users-gsanc--openclaw-workspace (not created
│    yet; it appears after the first Claude CLI turn in this workspace).
│  - Fix: run openclaw models auth login --provider anthropic --method
│    cli --set-default.
│
◇  Gateway auth
│  Gateway auth is off or missing a token. Token auth is now the
│  recommended default (including loopback).
│
◇  State integrity
│  - OAuth dir not present (~\.openclaw\credentials). Skipping create
│    because no WhatsApp/pairing channel config is active.
│
◇  Security
│  - No channel security warnings detected.
│  - Run: openclaw security audit --deep
│
◇  Skills status
│  Eligible: 31
│  Missing requirements: 39
│  Blocked by allowlist: 0
│
◇  Plugins
│  Loaded: 59
│  Imported: 1
│  Disabled: 43
│  Errors: 0
│
◇  Shell completion
│  Shell completion is configured in your zsh profile but the cache is
│  missing.
│  Regenerating cache...
```
