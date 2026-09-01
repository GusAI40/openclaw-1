#!/bin/bash
# bootstrap-tenant.sh — Provision a new OpenClaw + Hermes tenant on a shared Hetzner host.
#
# Usage:  ./bootstrap-tenant.sh <TENANT_ID> <DOMAIN> <OWNER_EMAIL>
# Example: ./bootstrap-tenant.sh julian julian.ubntag.com julian@example.com
#
# Idempotent: re-running with the same TENANT_ID is safe (re-renders templates, preserves volumes).
# Time budget: ~60-90 seconds per tenant (mostly waiting for healthcheck).

set -euo pipefail

# ============================================================================
# 0. Arg parsing + validation
# ============================================================================
if [[ $# -ne 3 ]]; then
    echo "Usage: $0 <TENANT_ID> <DOMAIN> <OWNER_EMAIL>" >&2
    echo "Example: $0 julian julian.ubntag.com julian@example.com" >&2
    exit 2
fi

TENANT_ID="$1"
DOMAIN="$2"
OWNER_EMAIL="$3"

# Validate TENANT_ID: lowercase alphanumeric + hyphens, 3-32 chars, must start with letter
if ! [[ "$TENANT_ID" =~ ^[a-z][a-z0-9-]{2,31}$ ]]; then
    echo "ERROR: TENANT_ID must be lowercase alphanumeric (with optional hyphens), 3-32 chars, start with a letter." >&2
    echo "Got: '$TENANT_ID'" >&2
    exit 2
fi

# Validate DOMAIN: basic FQDN check
if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
    echo "ERROR: DOMAIN must be a valid FQDN (lowercase). Got: '$DOMAIN'" >&2
    exit 2
fi

# Validate OWNER_EMAIL: simple shape check
if ! [[ "$OWNER_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
    echo "ERROR: OWNER_EMAIL must be a valid email shape. Got: '$OWNER_EMAIL'" >&2
    exit 2
fi

TENANT_NAME="${TENANT_ID^}"  # capitalized for display
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/_template"
TENANT_ROOT="/home/tagai/tenants/${TENANT_ID}"
TENANT_OPENCLAW="${TENANT_ROOT}/openclaw"
TENANT_CONFIG="${TENANT_ROOT}/.openclaw"
TENANT_WORKSPACE="${TENANT_ROOT}/workspace"
CADDY_INCLUDE_DIR="/etc/caddy/Caddyfile.d"
CADDY_TENANT_CONF="${CADDY_INCLUDE_DIR}/${TENANT_ID}.conf"

NOW_ISO8601="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Resolved later
GATEWAY_PORT=""
BRIDGE_PORT=""
GATEWAY_TOKEN=""
OPENCLAW_IMAGE="${OPENCLAW_IMAGE:-openclaw:tagai}"
OPENCLAW_IMAGE_VERSION=""

# ============================================================================
# Cleanup trap (on error only — successful runs leave everything in place)
# ============================================================================
CLEANUP_ENABLED=1
created_dirs=()
created_files=()

cleanup_on_error() {
    local rc=$?
    if [[ $rc -eq 0 ]] || [[ $CLEANUP_ENABLED -eq 0 ]]; then
        return
    fi
    echo ""
    echo "[!] Bootstrap failed (exit $rc) — rolling back created artifacts..."
    # Stop container if started
    if docker ps -a --format '{{.Names}}' | grep -q "^openclaw-${TENANT_ID}-gateway$" 2>/dev/null; then
        echo "  - Stopping container openclaw-${TENANT_ID}-gateway"
        docker stop "openclaw-${TENANT_ID}-gateway" 2>/dev/null || true
        docker rm "openclaw-${TENANT_ID}-gateway" 2>/dev/null || true
    fi
    # Remove Caddy block
    if [[ -f "$CADDY_TENANT_CONF" ]] && [[ "${CADDY_BLOCK_ADDED:-0}" -eq 1 ]]; then
        echo "  - Removing $CADDY_TENANT_CONF"
        sudo rm -f "$CADDY_TENANT_CONF"
        sudo systemctl reload caddy 2>/dev/null || true
    fi
    # Files created (use +"${arr[@]}" guard for empty arrays under set -u)
    for f in ${created_files[@]+"${created_files[@]}"}; do
        [[ -f "$f" ]] && rm -f "$f"
    done
    # Empty dirs (don't nuke volumes with data)
    for d in ${created_dirs[@]+"${created_dirs[@]}"}; do
        if [[ -d "$d" ]] && [[ -z "$(ls -A "$d" 2>/dev/null)" ]]; then
            rmdir "$d" 2>/dev/null || true
        fi
    done
    echo "[!] Rollback complete. Volumes preserved at $TENANT_ROOT (if any data) — manually remove if desired."
}
trap cleanup_on_error EXIT

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "[ERROR] $*" >&2; exit 1; }

# ============================================================================
# 1. Generate (or reuse) gateway token
# ============================================================================
TOKEN_FILE="${TENANT_ROOT}/.gateway-token"
if [[ -f "$TOKEN_FILE" ]]; then
    GATEWAY_TOKEN="$(cat "$TOKEN_FILE")"
    log "Reusing existing gateway token (idempotent re-run)"
else
    GATEWAY_TOKEN="$(openssl rand -hex 32)"
    log "Generated new gateway token (32 bytes hex)"
fi

# ============================================================================
# 2. Allocate deterministic ports from hash(TENANT_ID)
# ============================================================================
# Use sha256, take first 4 hex chars, mod 99, +1 -> slot 1..99
slot_hex="$(printf '%s' "$TENANT_ID" | sha256sum | cut -c1-4)"
slot_dec=$(( 0x$slot_hex ))
slot=$(( slot_dec % 99 + 1 ))
GATEWAY_PORT=$(( 18800 + slot ))
BRIDGE_PORT=$(( 19000 + slot ))
log "Port allocation: gateway=${GATEWAY_PORT}, bridge=${BRIDGE_PORT} (slot ${slot} from hash)"

# Sanity check: port not already used by a DIFFERENT tenant
if ss -tln 2>/dev/null | grep -qE "127\.0\.0\.1:${GATEWAY_PORT}[[:space:]]"; then
    # OK if it's our own container (idempotent re-run)
    if ! docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep -qE "^openclaw-${TENANT_ID}-gateway"; then
        fail "Port ${GATEWAY_PORT} is in use by another process. Collision in slot allocation — pick a different TENANT_ID."
    fi
fi

# ============================================================================
# 3. Create tenant directory structure
# ============================================================================
log "Creating tenant directories under ${TENANT_ROOT}"
for d in "$TENANT_ROOT" "$TENANT_OPENCLAW" "$TENANT_CONFIG" "$TENANT_WORKSPACE" \
         "$TENANT_CONFIG/corp" "$TENANT_CONFIG/memory" "$TENANT_CONFIG/credentials" \
         "$TENANT_CONFIG/identity" "$TENANT_CONFIG/secrets" "$TENANT_CONFIG/hindsight" \
         "$TENANT_CONFIG/backups" "$TENANT_WORKSPACE/.agents/skills/hermes-army"; do
    if [[ ! -d "$d" ]]; then
        mkdir -p "$d"
        created_dirs+=("$d")
    fi
done

# Persist the token
echo "$GATEWAY_TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
created_files+=("$TOKEN_FILE")

# ============================================================================
# 4. Determine OPENCLAW_IMAGE_VERSION (schema-clobber prevention)
# ============================================================================
log "Reading runtime version from image ${OPENCLAW_IMAGE} (schema-clobber prevention)"
# openclaw's package.json lives at /app/package.json inside the image (NOT /home/node/)
if ! OPENCLAW_IMAGE_VERSION="$(docker run --rm --entrypoint=cat "$OPENCLAW_IMAGE" \
    /app/package.json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])' 2>/dev/null)"; then
    fail "Cannot determine version from image ${OPENCLAW_IMAGE}. Pin to a real version tag and try again."
fi
OPENCLAW_IMAGE_VERSION="$(echo "$OPENCLAW_IMAGE_VERSION" | tr -d '[:space:]')"
log "Runtime version: ${OPENCLAW_IMAGE_VERSION} (will be baked into openclaw.json meta.lastTouchedVersion)"

# ============================================================================
# 5. Render docker-compose.tenant.yml
# ============================================================================
log "Rendering docker-compose.tenant.yml"
COMPOSE_OUT="${TENANT_OPENCLAW}/docker-compose.yml"
# envsubst doesn't handle our {{var}} pattern — use sed
render_template() {
    local src="$1"
    local dst="$2"
    sed \
        -e "s|{{TENANT_ID}}|${TENANT_ID}|g" \
        -e "s|{{TENANT_NAME}}|${TENANT_NAME}|g" \
        -e "s|{{OWNER_EMAIL}}|${OWNER_EMAIL}|g" \
        -e "s|{{DOMAIN}}|${DOMAIN}|g" \
        -e "s|{{GATEWAY_PORT}}|${GATEWAY_PORT}|g" \
        -e "s|{{BRIDGE_PORT}}|${BRIDGE_PORT}|g" \
        -e "s|{{GATEWAY_TOKEN}}|${GATEWAY_TOKEN}|g" \
        -e "s|{{OPENCLAW_IMAGE}}|${OPENCLAW_IMAGE}|g" \
        -e "s|{{OPENCLAW_IMAGE_VERSION}}|${OPENCLAW_IMAGE_VERSION}|g" \
        -e "s|{{NOW_ISO8601}}|${NOW_ISO8601}|g" \
        "$src" > "$dst"
}

# The compose template uses ${VAR} envsubst style, not {{}}, so just copy it
cp "${TEMPLATE_DIR}/docker-compose.tenant.yml.tpl" "$COMPOSE_OUT"
created_files+=("$COMPOSE_OUT")

# Render .env
ENV_OUT="${TENANT_OPENCLAW}/.env"
render_template "${TEMPLATE_DIR}/.env.tpl" "$ENV_OUT"
chmod 600 "$ENV_OUT"
created_files+=("$ENV_OUT")

# Source shared host-wide env onto .env (append SHARED_* if not already set)
SHARED_ENV="/home/tagai/.openclaw-shared.env"
if [[ -f "$SHARED_ENV" ]]; then
    log "Merging shared host env from ${SHARED_ENV}"
    # Append shared values that aren't already set
    while IFS='=' read -r key value; do
        [[ -z "$key" ]] && continue
        [[ "$key" =~ ^# ]] && continue
        if ! grep -q "^${key}=" "$ENV_OUT"; then
            echo "${key}=${value}" >> "$ENV_OUT"
        fi
    done < <(grep -E '^(SHARED_|ANTHROPIC_API_KEY|CLAUDE_)' "$SHARED_ENV" 2>/dev/null || true)
else
    log "WARNING: ${SHARED_ENV} not found — tenant will boot without shared infra credentials."
fi

# ============================================================================
# 6. Render openclaw.json with schema-clobber-safe version string
# ============================================================================
log "Rendering openclaw.json (with meta.lastTouchedVersion=${OPENCLAW_IMAGE_VERSION})"
OPENCLAW_JSON_OUT="${TENANT_CONFIG}/openclaw.json"

if [[ -f "$OPENCLAW_JSON_OUT" ]]; then
    # Idempotent re-run: snapshot existing config before overwriting
    cp "$OPENCLAW_JSON_OUT" "${OPENCLAW_JSON_OUT}.pre-rebootstrap-$(date -u +%Y%m%dT%H%M%SZ)"
    log "  - Snapshotted existing openclaw.json before re-render"
fi

render_template "${TEMPLATE_DIR}/openclaw.json.tpl" "$OPENCLAW_JSON_OUT"
chmod 640 "$OPENCLAW_JSON_OUT"
created_files+=("$OPENCLAW_JSON_OUT")

# Validate JSON shape
if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c "import json; json.load(open('$OPENCLAW_JSON_OUT'))" 2>/dev/null; then
        fail "Rendered openclaw.json is not valid JSON — template bug. See ${OPENCLAW_JSON_OUT}"
    fi
elif command -v jq >/dev/null 2>&1; then
    jq empty "$OPENCLAW_JSON_OUT" || fail "Rendered openclaw.json failed jq validation"
fi

# ============================================================================
# 7. Seed corp roster CSVs (prefix IDs with TENANT_ID)
# ============================================================================
log "Seeding 100-agent corp roster from templates"
for csv in corp-c-suite corp-board corp-agent-roster corp-b2b-sales; do
    src="${TEMPLATE_DIR}/corp/${csv}.csv"
    dst="${TENANT_CONFIG}/corp/${csv}.csv"
    if [[ ! -f "$src" ]]; then
        log "  - WARNING: ${src} not found, skipping"
        continue
    fi
    # Prefix the ID column (first column) values with <TENANT_ID>- for any line whose first column matches CORP-, BOD-, CEO-, B2B-
    awk -v tid="$TENANT_ID" 'BEGIN{FS=OFS=","} \
        NR==1 {print; next} \
        $1 ~ /^(CORP|BOD|CEO|B2B)-[0-9]+$/ {$1 = tid "-" $1; print; next} \
        {print}' "$src" > "$dst"
    created_files+=("$dst")
done

# Drop a README into the corp dir
cat > "${TENANT_CONFIG}/corp/README.md" <<EOF
# Corp Roster for Tenant: ${TENANT_ID} (${TENANT_NAME})

All agent IDs are prefixed with \`${TENANT_ID}-\` to guarantee no cross-tenant ID collisions in the kanban store.

| File | Purpose |
|---|---|
| corp-board.csv | 7 board oracles |
| corp-c-suite.csv | 8 C-suite (Gus = CEO-001, Jarvis = CEO-002, Hermes = CEO-003) |
| corp-agent-roster.csv | 100 workers grouped into 10 departments |
| corp-b2b-sales.csv | B2B sales sub-org under CMO |

Bootstrapped: ${NOW_ISO8601}
EOF
created_files+=("${TENANT_CONFIG}/corp/README.md")

# ============================================================================
# 8. Seed hermes-army skill bundle (parameterized for tenant)
# ============================================================================
log "Seeding hermes-army skill bundle (${TENANT_ID}-scoped)"
HERMES_DST="${TENANT_WORKSPACE}/.agents/skills/hermes-army"
for skill in corp-dashboard multi-platform nano-spawner tenant-onboarder; do
    src="${TEMPLATE_DIR}/hermes-army/${skill}.md"
    dst="${HERMES_DST}/${skill}.md"
    if [[ ! -f "$src" ]]; then
        log "  - WARNING: ${src} not found, skipping"
        continue
    fi
    render_template "$src" "$dst"
    created_files+=("$dst")
done

# ============================================================================
# 8.5 Seed agent auth-profiles.json + auth-state.json (LLM provider keys)
#    Without these, the runtime cannot authenticate to DeepSeek/Anthropic/OpenAI
#    etc. and falls back through the model chain forever.
# ============================================================================
log "Seeding agents/main/agent auth files (LLM provider credentials)"
AGENTS_DST="${TENANT_CONFIG}/agents/main/agent"
mkdir -p "$AGENTS_DST"
for src_name in auth-profiles.json auth-state.json; do
    src="${TEMPLATE_DIR}/agents-main-agent/${src_name}"
    dst="${AGENTS_DST}/${src_name}"
    if [[ ! -f "$src" ]]; then
        log "  - WARNING: ${src} not found, tenant will fall back to Gemini until auth is configured manually"
        continue
    fi
    cp "$src" "$dst"
    chmod 600 "$dst"
    created_files+=("$dst")
done

# ============================================================================

# ============================================================================
# 8.6 Shared projects bind-mount verification
#    The compose template mounts /home/tagai/shared-projects -> /home/node/.openclaw/shared
#    (read-write). No per-tenant symlinks required. This step just logs what
#    shared resources the new tenant will see inside its container.
# ============================================================================
SHARED_HOST_DIR="/home/tagai/shared-projects"
if [[ -d "$SHARED_HOST_DIR" ]]; then
    log "Shared resources visible to this tenant at /home/node/.openclaw/shared/:"
    for proj in "$SHARED_HOST_DIR"/*/; do
        [[ -d "$proj" ]] || continue
        log "  - $(basename "$proj")"
    done
else
    log "  - NOTE: $SHARED_HOST_DIR does not exist yet on this host."
    log "    Tenant will have an empty /home/node/.openclaw/shared/ until shared repos are cloned."
fi

# 9. Install Caddy site block
# ============================================================================
log "Installing Caddy site block: ${CADDY_TENANT_CONF}"
if [[ ! -d "$CADDY_INCLUDE_DIR" ]]; then
    fail "Caddy include dir ${CADDY_INCLUDE_DIR} does not exist. Run host prep from README.md first."
fi

CADDY_BLOCK_ADDED=0
TMP_CADDY="$(mktemp)"
render_template "${TEMPLATE_DIR}/Caddyfile.tenant.conf.tpl" "$TMP_CADDY"
if [[ -f "$CADDY_TENANT_CONF" ]] && cmp -s "$TMP_CADDY" "$CADDY_TENANT_CONF"; then
    log "  - Caddy block unchanged (idempotent)"
    rm -f "$TMP_CADDY"
else
    sudo cp "$TMP_CADDY" "$CADDY_TENANT_CONF"
    sudo chown root:caddy "$CADDY_TENANT_CONF" 2>/dev/null || sudo chown root:root "$CADDY_TENANT_CONF"
    sudo chmod 644 "$CADDY_TENANT_CONF"
    rm -f "$TMP_CADDY"
    CADDY_BLOCK_ADDED=1
fi

# ============================================================================
# 10. docker compose up -d
# ============================================================================
log "Starting OpenClaw container for tenant ${TENANT_ID}"
cd "$TENANT_OPENCLAW"
docker compose up -d

# ============================================================================
# 11. Wait for gateway healthcheck (max 60s)
# ============================================================================
log "Waiting for gateway healthcheck on http://127.0.0.1:${GATEWAY_PORT}/healthz"
for i in {1..30}; do
    if curl -sf "http://127.0.0.1:${GATEWAY_PORT}/healthz" >/dev/null 2>&1; then
        log "  - Gateway healthy after ${i}*2s"
        break
    fi
    if [[ $i -eq 30 ]]; then
        log "  - Gateway healthcheck timed out after 60s. Container logs:"
        docker logs --tail=40 "openclaw-${TENANT_ID}-gateway" 2>&1 | sed 's/^/    /'
        fail "Gateway did not become healthy. Check container logs."
    fi
    sleep 2
done

# ============================================================================
# 12. Reload Caddy
# ============================================================================
log "Reloading Caddy"
sudo systemctl reload caddy

# ============================================================================
# 13. Verify external HTTPS route (optional — only works if DNS is live)
# ============================================================================
log "Verifying external route https://${DOMAIN}/"
if curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/" 2>/dev/null | grep -qE '^(200|301|302|401|403)$'; then
    log "  - External route responding"
else
    log "  - WARNING: External route did NOT respond. Check DNS, Caddy logs, and certificate provisioning."
    log "  -          The tenant is still operational locally on port ${GATEWAY_PORT}."
fi

# ============================================================================
# 14. Done — disable cleanup trap, print summary
# ============================================================================
CLEANUP_ENABLED=0
trap - EXIT

echo ""
echo "============================================================"
echo " Tenant '${TENANT_ID}' provisioned"
echo "============================================================"
echo "  Tenant ID:        ${TENANT_ID}"
echo "  Tenant Name:      ${TENANT_NAME}"
echo "  Owner Email:      ${OWNER_EMAIL}"
echo "  Domain:           https://${DOMAIN}"
echo "  Gateway port:     ${GATEWAY_PORT} (loopback only)"
echo "  Bridge port:      ${BRIDGE_PORT} (loopback only)"
echo "  Image:            ${OPENCLAW_IMAGE} (version ${OPENCLAW_IMAGE_VERSION})"
echo "  Config dir:       ${TENANT_CONFIG}"
echo "  Workspace dir:    ${TENANT_WORKSPACE}"
echo "  Container:        openclaw-${TENANT_ID}-gateway"
echo "  Caddy block:      ${CADDY_TENANT_CONF}"
echo ""
echo "  Gateway token (ONE-TIME DISPLAY — save it now):"
echo "    ${GATEWAY_TOKEN}"
echo ""
echo "  Token also stored at: ${TOKEN_FILE} (mode 600)"
echo ""
echo "  Next steps:"
echo "    1. Test: curl -sf https://${DOMAIN}/ && echo OK"
echo "    2. Pair tenant's Telegram bot: docker exec -it openclaw-${TENANT_ID}-gateway node dist/index.js telegram pair"
echo "    3. Verify corp roster: ls ${TENANT_CONFIG}/corp/"
echo "    4. View this tenant's logs: docker logs -f openclaw-${TENANT_ID}-gateway"
echo "    5. List all tenants: ${SCRIPT_DIR}/list-tenants.sh"
echo ""
echo "  To tear down: ${SCRIPT_DIR}/teardown-tenant.sh ${TENANT_ID}"
echo "============================================================"
