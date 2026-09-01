# Per-tenant compose env file — rendered at bootstrap time by bootstrap-tenant.sh.
# Host-wide shared infra creds load automatically via docker-compose env_file directive
# pointing at /home/tagai/.openclaw-shared.env. Do NOT duplicate them here.

# ===== Tenant identity =====
TENANT_ID={{TENANT_ID}}
TENANT_NAME={{TENANT_NAME}}
OWNER_EMAIL={{OWNER_EMAIL}}
DOMAIN={{DOMAIN}}

# ===== OpenClaw image pin (NEVER :latest in production) =====
OPENCLAW_IMAGE={{OPENCLAW_IMAGE}}
OPENCLAW_IMAGE_VERSION={{OPENCLAW_IMAGE_VERSION}}

# ===== Paths (per-tenant volumes) =====
OPENCLAW_CONFIG_DIR=/home/tagai/tenants/{{TENANT_ID}}/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/tagai/tenants/{{TENANT_ID}}/workspace

# ===== Ports (deterministic from sha256(TENANT_ID), slot 1..99) =====
OPENCLAW_GATEWAY_PORT={{GATEWAY_PORT}}
OPENCLAW_BRIDGE_PORT={{BRIDGE_PORT}}
OPENCLAW_GATEWAY_BIND=lan

# ===== Per-tenant gateway auth (DO NOT SHARE) =====
OPENCLAW_GATEWAY_TOKEN={{GATEWAY_TOKEN}}
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=

# ===== Per-tenant Telegram bot (set after BotFather pairing, then `docker compose up -d`) =====
# To set up Julian's bot:
#   1. Message @BotFather on Telegram, send /newbot
#   2. Name it (e.g. "Julian's Jarvis"), pick a username ending in _bot
#   3. BotFather replies with a token like 7234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#   4. Get the tenant's numeric Telegram user ID from @userinfobot
#   5. Paste both below, then: cd <this dir> && docker compose up -d
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USERS=
TELEGRAM_HOME_CHANNEL=

# ===== Per-tenant LLM overrides (optional — leave blank to use shared host keys) =====
# If you fill these, the container env overrides the env_file value for this tenant only.
# Useful for per-tenant billing / quota isolation later.
HERMES_OPENAI_KEY=
DEEPSEEK_API_KEY=

# ===== Misc =====
OPENCLAW_TZ=UTC
XDG_CONFIG_HOME=/home/tagai/tenants/{{TENANT_ID}}/.config
