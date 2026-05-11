# Parameterized OpenClaw compose file — one per tenant.
# Variables resolved by `envsubst` from .env at provision time.
# Container/volume/port names all include ${TENANT_ID} for full isolation.

services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    container_name: openclaw-${TENANT_ID}-gateway
    environment:
      HOME: /home/node
      TERM: xterm-256color
      # Per-tenant gateway auth
      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: ${OPENCLAW_ALLOW_INSECURE_PRIVATE_WS:-}
      # Shared anthropic / claude session — read from host shared env
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      CLAUDE_AI_SESSION_KEY: ${CLAUDE_AI_SESSION_KEY:-}
      CLAUDE_WEB_SESSION_KEY: ${CLAUDE_WEB_SESSION_KEY:-}
      CLAUDE_WEB_COOKIE: ${CLAUDE_WEB_COOKIE:-}
      # Per-tenant Hermes / LLM key — falls back to shared if unset
      HERMES_OPENAI_KEY: ${HERMES_OPENAI_KEY:-${SHARED_HERMES_OPENAI_KEY:-}}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-${SHARED_DEEPSEEK_API_KEY:-}}
      # Per-tenant Hermes Telegram bot (each tenant has its own)
      TELEGRAM_BOT_TOKEN: ${TENANT_TELEGRAM_BOT_TOKEN:-}
      TELEGRAM_ALLOWED_USERS: ${TENANT_TELEGRAM_ALLOWED_USERS:-}
      TELEGRAM_HOME_CHANNEL: ${TENANT_TELEGRAM_HOME_CHANNEL:-}
      # Shared telephony stack (Telnyx trunk, LiveKit project) — same keys across tenants
      TELNYX_API_KEY: ${SHARED_TELNYX_API_KEY:-}
      TELNYX_CONNECTION_ID: ${SHARED_TELNYX_CONNECTION_ID:-}
      LIVEKIT_API_KEY: ${SHARED_LIVEKIT_API_KEY:-}
      LIVEKIT_API_SECRET: ${SHARED_LIVEKIT_API_SECRET:-}
      LIVEKIT_URL: ${SHARED_LIVEKIT_URL:-}
      # Per-tenant LiveKit room prefix — guarantees room-${TENANT_ID}-<x> namespacing
      LIVEKIT_OUTBOUND_ROOM_PREFIX: room-${TENANT_ID}
      # Shared speech stack
      DEEPGRAM_API_KEY: ${SHARED_DEEPGRAM_API_KEY:-}
      CARTESIA_API_KEY: ${SHARED_CARTESIA_API_KEY:-}
      # Per-tenant Supabase scope — RLS by tenant_id, but key is shared
      SUPABASE_URL: ${SHARED_SUPABASE_URL:-}
      SUPABASE_KEY: ${SHARED_SUPABASE_KEY:-}
      # Identity
      TENANT_ID: ${TENANT_ID}
      TENANT_NAME: ${TENANT_NAME}
      OWNER_EMAIL: ${OWNER_EMAIL}
      TZ: ${OPENCLAW_TZ:-UTC}
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
      # Mount shared Telnyx/LiveKit secrets read-only if you prefer file-based over env
      # - /home/tagai/.openclaw-shared-secrets:/home/node/.openclaw-shared:ro
    ports:
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"
      - "127.0.0.1:${OPENCLAW_BRIDGE_PORT}:18790"
    init: true
    restart: unless-stopped
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND:-lan}",
        "--port",
        "18789",
      ]
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:18789/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    labels:
      tag.tenant: "${TENANT_ID}"
      tag.role: "openclaw-gateway"
      tag.domain: "${DOMAIN}"

# NOTE: We intentionally drop the openclaw-cli sidecar from the per-tenant
# compose file. The CLI is ephemeral and shared host-wide — for one-shot CLI
# invocations against a specific tenant, exec into the gateway container:
#   docker exec -it openclaw-${TENANT_ID}-gateway node dist/index.js <cmd>
