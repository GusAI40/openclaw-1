# Parameterized OpenClaw compose file — one per tenant.
# Variables resolved from .env at provision time.
# Container/volume/port names all include ${TENANT_ID} for full isolation.
#
# Env loading strategy (matches existing openclaw-gateway pattern):
#   env_file[0] = .env (this tenant's per-tenant + host-runtime vars)
#   env_file[1] = /home/tagai/.openclaw-shared.env (host-wide shared infra)
#   environment: block = only vars that need runtime substitution (TENANT_ID interpolation)

name: openclaw-${TENANT_ID}

services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    container_name: openclaw-${TENANT_ID}-gateway
    env_file:
      - .env
      - /home/tagai/.openclaw-shared.env
    environment:
      # Per-tenant LiveKit room prefix — guarantees room-${TENANT_ID}-* namespacing
      # so call-rooms can't cross tenants.
      LIVEKIT_OUTBOUND_ROOM_PREFIX: room-${TENANT_ID}
      # Identity (handy for the gateway's own logs)
      TENANT_ID: ${TENANT_ID}
      TENANT_NAME: ${TENANT_NAME}
      OWNER_EMAIL: ${OWNER_EMAIL}
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
      - /home/tagai/shared-projects:/home/node/.openclaw/shared
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

# NOTE: The openclaw-cli sidecar is intentionally dropped from the per-tenant
# compose. For one-shot CLI invocations against this tenant, exec into the gateway:
#   docker exec -it openclaw-${TENANT_ID}-gateway node dist/index.js <cmd>
