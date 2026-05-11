#!/bin/bash
# teardown-tenant.sh — Reverse of bootstrap-tenant.sh.
# Stops container, removes Caddy block, archives tenant dir. NEVER deletes data.
#
# Usage: ./teardown-tenant.sh <TENANT_ID> [--force]

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <TENANT_ID> [--force]" >&2
    exit 2
fi

TENANT_ID="$1"
FORCE="${2:-}"

if ! [[ "$TENANT_ID" =~ ^[a-z][a-z0-9-]{2,31}$ ]]; then
    echo "ERROR: Invalid TENANT_ID: '$TENANT_ID'" >&2
    exit 2
fi

TENANT_ROOT="/home/tagai/tenants/${TENANT_ID}"
TENANT_OPENCLAW="${TENANT_ROOT}/openclaw"
CADDY_TENANT_CONF="/etc/caddy/Caddyfile.d/${TENANT_ID}.conf"
ARCHIVE_DIR="/home/tagai/tenants-archived"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_PATH="${ARCHIVE_DIR}/${TENANT_ID}-${TS}.tar.gz"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

if [[ ! -d "$TENANT_ROOT" ]]; then
    log "Tenant ${TENANT_ID} not found at ${TENANT_ROOT}. Nothing to tear down."
    # Still try to remove Caddy block in case of partial state
    if [[ -f "$CADDY_TENANT_CONF" ]]; then
        sudo rm -f "$CADDY_TENANT_CONF"
        sudo systemctl reload caddy
        log "Removed orphan Caddy block ${CADDY_TENANT_CONF}"
    fi
    exit 0
fi

# Confirmation
if [[ "$FORCE" != "--force" ]]; then
    echo "About to tear down tenant: ${TENANT_ID}"
    echo "  - Stop & remove container: openclaw-${TENANT_ID}-gateway"
    echo "  - Remove Caddy block:      ${CADDY_TENANT_CONF}"
    echo "  - Archive (not delete):    ${TENANT_ROOT} -> ${ARCHIVE_PATH}"
    read -r -p "Proceed? [yes/no]: " ans
    if [[ "$ans" != "yes" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# 1. Stop container
log "Stopping container openclaw-${TENANT_ID}-gateway"
if [[ -d "$TENANT_OPENCLAW" ]] && [[ -f "${TENANT_OPENCLAW}/docker-compose.yml" ]]; then
    (cd "$TENANT_OPENCLAW" && docker compose down --remove-orphans) || true
fi
docker stop "openclaw-${TENANT_ID}-gateway" 2>/dev/null || true
docker rm "openclaw-${TENANT_ID}-gateway" 2>/dev/null || true

# 2. Remove Caddy block
if [[ -f "$CADDY_TENANT_CONF" ]]; then
    log "Removing Caddy block ${CADDY_TENANT_CONF}"
    sudo rm -f "$CADDY_TENANT_CONF"
    sudo systemctl reload caddy
fi

# 3. Archive (NEVER delete)
log "Archiving tenant dir to ${ARCHIVE_PATH}"
mkdir -p "$ARCHIVE_DIR"
tar czf "$ARCHIVE_PATH" -C "$(dirname "$TENANT_ROOT")" "$(basename "$TENANT_ROOT")"

# 4. Move tenant dir aside (so a bootstrap with same TENANT_ID gets a fresh slate)
mv "$TENANT_ROOT" "${TENANT_ROOT}.removed-${TS}"
log "Tenant dir moved to ${TENANT_ROOT}.removed-${TS} (delete manually after verifying archive)"

log ""
log "Teardown complete for tenant ${TENANT_ID}"
log "  Archive:  ${ARCHIVE_PATH}"
log "  Tombstone: ${TENANT_ROOT}.removed-${TS}"
log ""
log "To restore: tar xzf ${ARCHIVE_PATH} -C /home/tagai/tenants/ && ./bootstrap-tenant.sh ${TENANT_ID} <DOMAIN> <OWNER_EMAIL>"
