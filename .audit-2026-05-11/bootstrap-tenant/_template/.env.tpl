# Per-tenant compose env file — rendered at bootstrap time.
# Sigil convention:
#   {{TENANT_*}}   = per-tenant value (rendered by bootstrap-tenant.sh)
#   ${SHARED_*}    = shared host-wide value (sourced from /home/tagai/.openclaw-shared.env)

# ===== Tenant identity =====
TENANT_ID={{TENANT_ID}}
TENANT_NAME={{TENANT_NAME}}
OWNER_EMAIL={{OWNER_EMAIL}}
DOMAIN={{DOMAIN}}

# ===== OpenClaw image pin (NEVER use :latest or :tagai in production) =====
OPENCLAW_IMAGE={{OPENCLAW_IMAGE}}
OPENCLAW_IMAGE_VERSION={{OPENCLAW_IMAGE_VERSION}}

# ===== Paths (per-tenant volumes) =====
OPENCLAW_CONFIG_DIR=/home/tagai/tenants/{{TENANT_ID}}/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/tagai/tenants/{{TENANT_ID}}/workspace

# ===== Ports (deterministic from hash of TENANT_ID, slot 1..99) =====
OPENCLAW_GATEWAY_PORT={{GATEWAY_PORT}}
OPENCLAW_BRIDGE_PORT={{BRIDGE_PORT}}
OPENCLAW_GATEWAY_BIND=lan

# ===== Per-tenant gateway auth (DO NOT SHARE) =====
OPENCLAW_GATEWAY_TOKEN={{GATEWAY_TOKEN}}
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=

# ===== Per-tenant Hermes / LLM (each tenant gets own quota, optional) =====
# If unset, falls back to SHARED_* values from /home/tagai/.openclaw-shared.env
# Bootstrap leaves these blank; operator fills in tenant-specific keys post-provision.
HERMES_OPENAI_KEY=
DEEPSEEK_API_KEY=

# ===== Per-tenant Telegram (each tenant has own @bot) =====
# Bootstrap leaves these blank; operator runs BotFather, then sets these and restarts container.
TENANT_TELEGRAM_BOT_TOKEN=
TENANT_TELEGRAM_ALLOWED_USERS=
TENANT_TELEGRAM_HOME_CHANNEL=

# ===== Per-tenant Claude session (optional, falls back to shared) =====
ANTHROPIC_API_KEY=${SHARED_ANTHROPIC_API_KEY:-}
CLAUDE_AI_SESSION_KEY=${SHARED_CLAUDE_AI_SESSION_KEY:-}
CLAUDE_WEB_SESSION_KEY=${SHARED_CLAUDE_WEB_SESSION_KEY:-}
CLAUDE_WEB_COOKIE=${SHARED_CLAUDE_WEB_COOKIE:-}

# ===== Shared infrastructure (loaded from /home/tagai/.openclaw-shared.env) =====
# DO NOT put values here — these are read at runtime from the shared env file
SHARED_TELNYX_API_KEY=${SHARED_TELNYX_API_KEY:-}
SHARED_TELNYX_CONNECTION_ID=${SHARED_TELNYX_CONNECTION_ID:-}
SHARED_TELNYX_PHONE_NUMBER=${SHARED_TELNYX_PHONE_NUMBER:-}
SHARED_LIVEKIT_API_KEY=${SHARED_LIVEKIT_API_KEY:-}
SHARED_LIVEKIT_API_SECRET=${SHARED_LIVEKIT_API_SECRET:-}
SHARED_LIVEKIT_URL=${SHARED_LIVEKIT_URL:-}
SHARED_DEEPGRAM_API_KEY=${SHARED_DEEPGRAM_API_KEY:-}
SHARED_CARTESIA_API_KEY=${SHARED_CARTESIA_API_KEY:-}
SHARED_SUPABASE_URL=${SHARED_SUPABASE_URL:-}
SHARED_SUPABASE_KEY=${SHARED_SUPABASE_KEY:-}
SHARED_HERMES_OPENAI_KEY=${SHARED_HERMES_OPENAI_KEY:-}
SHARED_DEEPSEEK_API_KEY=${SHARED_DEEPSEEK_API_KEY:-}
SHARED_ANTHROPIC_API_KEY=${SHARED_ANTHROPIC_API_KEY:-}
SHARED_CLAUDE_AI_SESSION_KEY=${SHARED_CLAUDE_AI_SESSION_KEY:-}
SHARED_CLAUDE_WEB_SESSION_KEY=${SHARED_CLAUDE_WEB_SESSION_KEY:-}
SHARED_CLAUDE_WEB_COOKIE=${SHARED_CLAUDE_WEB_COOKIE:-}

# ===== Misc =====
OPENCLAW_TZ=UTC
XDG_CONFIG_HOME=/home/tagai/tenants/{{TENANT_ID}}/.config
