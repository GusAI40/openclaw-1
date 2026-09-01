#!/bin/sh
# deploy-vertical.sh — Business-in-a-Box deploy engine.
#
# Takes a SOLD client and stands up a per-client Jarvis tenant for a given
# business vertical (first vertical: construction). It does NOT reinvent the
# provisioner — it CALLS the battle-tested _tagai/bootstrap/bootstrap-tenant.sh
# and then overlays the chosen vertical (system prompt + skills + owner
# Telegram allowlist).
#
# Topology truth (do not regress): plain `docker compose` + Caddy on the host.
# The proven model is MANY tenants on ONE Hetzner CPX21 (87.99.148.242). A fresh
# dedicated VPS is only created when you pass --new-vps (most clients do NOT
# need one).
#
# Usage:
#   ./deploy-vertical.sh \
#       --vertical construction \
#       --client-id acme-builders \
#       --subdomain acme-builders.ubntag.com \
#       --owner-email owner@acme.com \
#       --owner-telegram 123456789 \
#       [--new-vps] [--vps-type cpx21] [--vps-location nbg1] [--dry-run]
#
# Run this ON the Hetzner host as the `tagai` user (that is where
# bootstrap-tenant.sh, Docker, and Caddy live). The only step that runs from a
# laptop is --new-vps (hcloud), which prints SSH instructions and exits.
#
# Idempotent: re-running with the same --client-id re-runs bootstrap (idempotent)
# and re-applies the vertical overlay. Safe.

set -eu

# ----------------------------------------------------------------------------
# Locate ourselves and the existing bootstrap tooling (DO NOT duplicate it).
# ----------------------------------------------------------------------------
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# _tagai/business-box/deploy -> _tagai
TAGAI_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../" && pwd)
BOOTSTRAP_DIR="$TAGAI_DIR/bootstrap"
BOOTSTRAP="$BOOTSTRAP_DIR/bootstrap-tenant.sh"
VERTICALS_DIR="$SCRIPT_DIR/../verticals"

HETZNER_IP="87.99.148.242"

# ----------------------------------------------------------------------------
# Args
# ----------------------------------------------------------------------------
VERTICAL=""
CLIENT_ID=""
SUBDOMAIN=""
OWNER_EMAIL=""
OWNER_TELEGRAM=""
NEW_VPS=0
VPS_TYPE="cpx21"
VPS_LOCATION="nbg1"
VPS_IMAGE="ubuntu-22.04"
DRY_RUN=0

die() { echo "[ERROR] $*" >&2; exit 1; }
log() { echo "[deploy-vertical] $*"; }

usage() {
    sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-2}"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --vertical)        VERTICAL="${2:-}"; shift 2 ;;
        --client-id)       CLIENT_ID="${2:-}"; shift 2 ;;
        --subdomain)       SUBDOMAIN="${2:-}"; shift 2 ;;
        --owner-email)     OWNER_EMAIL="${2:-}"; shift 2 ;;
        --owner-telegram)  OWNER_TELEGRAM="${2:-}"; shift 2 ;;
        --new-vps)         NEW_VPS=1; shift ;;
        --vps-type)        VPS_TYPE="${2:-}"; shift 2 ;;
        --vps-location)    VPS_LOCATION="${2:-}"; shift 2 ;;
        --dry-run)         DRY_RUN=1; shift ;;
        -h|--help)         usage 0 ;;
        *) die "Unknown arg: $1 (try --help)" ;;
    esac
done

# ----------------------------------------------------------------------------
# Validate (mirror bootstrap-tenant.sh's rules so we fail fast, before SSH/VPS)
# ----------------------------------------------------------------------------
[ -n "$VERTICAL" ]       || die "--vertical is required (e.g. construction)"
[ -n "$CLIENT_ID" ]      || die "--client-id is required"
[ -n "$SUBDOMAIN" ]      || die "--subdomain is required (e.g. acme.ubntag.com)"
[ -n "$OWNER_EMAIL" ]    || die "--owner-email is required"
[ -n "$OWNER_TELEGRAM" ] || die "--owner-telegram is required (NUMERIC Telegram user id, not @handle)"

VERTICAL_DIR="$VERTICALS_DIR/$VERTICAL"
[ -d "$VERTICAL_DIR" ] || die "Unknown vertical '$VERTICAL'. Looked in $VERTICALS_DIR. Available: $(ls "$VERTICALS_DIR" 2>/dev/null | tr '\n' ' ')"

# client-id == TENANT_ID rules from bootstrap-tenant.sh: ^[a-z][a-z0-9-]{2,31}$
echo "$CLIENT_ID" | grep -Eq '^[a-z][a-z0-9-]{2,31}$' \
    || die "--client-id must be lowercase, start with a letter, 3-32 chars, [a-z0-9-]. Got '$CLIENT_ID'."

# Telegram id must be all digits (numeric user id, the #1 onboarding footgun).
echo "$OWNER_TELEGRAM" | grep -Eq '^[0-9]+$' \
    || die "--owner-telegram must be the NUMERIC Telegram user id (digits only). '@username' will NOT work. Get it from @userinfobot."

# ----------------------------------------------------------------------------
# Optional: create a dedicated Hetzner VPS via hcloud.
# We do NOT assume hcloud is authenticated. If it isn't, we print the exact
# manual steps and exit non-fatally for the operator to run.
# ----------------------------------------------------------------------------
if [ "$NEW_VPS" -eq 1 ]; then
    log "--new-vps requested: provisioning a DEDICATED Hetzner server for $CLIENT_ID."
    SERVER_NAME="jarvis-$CLIENT_ID"

    if ! command -v hcloud >/dev/null 2>&1; then
        cat <<EOF
[!] hcloud CLI not found on this machine. Dedicated-VPS creation is a MANUAL step.

  Install + authenticate, then create the server:
    # macOS:  brew install hcloud   |  Linux: see github.com/hetznercloud/cli
    hcloud context create tag-business-box      # paste a Hetzner API token (read+write)
    hcloud server create \\
      --name $SERVER_NAME \\
      --type $VPS_TYPE \\
      --image $VPS_IMAGE \\
      --location $VPS_LOCATION \\
      --ssh-key id_hetzner

  Then note the new public IP and run host prep + this script ON that box.
EOF
        die "hcloud unavailable — see manual steps above."
    fi

    if ! hcloud server list >/dev/null 2>&1; then
        cat <<EOF
[!] hcloud is installed but NOT authenticated (no active context / bad token).
    Run:  hcloud context create tag-business-box   (paste a read+write API token)
    Then re-run with --new-vps.
EOF
        die "hcloud not authenticated."
    fi

    if hcloud server describe "$SERVER_NAME" >/dev/null 2>&1; then
        log "Server '$SERVER_NAME' already exists (idempotent). Reusing."
    elif [ "$DRY_RUN" -eq 1 ]; then
        log "[dry-run] would: hcloud server create --name $SERVER_NAME --type $VPS_TYPE --image $VPS_IMAGE --location $VPS_LOCATION --ssh-key id_hetzner"
    else
        log "Creating Hetzner server '$SERVER_NAME' ($VPS_TYPE / $VPS_LOCATION)..."
        hcloud server create \
            --name "$SERVER_NAME" \
            --type "$VPS_TYPE" \
            --image "$VPS_IMAGE" \
            --location "$VPS_LOCATION" \
            --ssh-key id_hetzner
    fi

    NEW_IP=$(hcloud server ip "$SERVER_NAME" 2>/dev/null || echo "")
    cat <<EOF

============================================================
 Dedicated VPS step complete.
   Server:  $SERVER_NAME
   IP:      ${NEW_IP:-<pending>}

 A dedicated box still needs the one-time host prep that the SHARED box
 already has (Docker, Caddy + /etc/caddy/Caddyfile.d import, the
 _tagai/bootstrap tooling, and the shared-secrets files). This script does
 NOT bootstrap a bare OS. Next:
   1. Point Vercel DNS: $SUBDOMAIN -> ${NEW_IP:-<new-ip>}
   2. Do host prep per _tagai/bootstrap/README.md "One-time host prep".
   3. Copy _tagai/bootstrap + secrets to the box, then run THIS script
      again on that box WITHOUT --new-vps.
============================================================
EOF
    exit 0
fi

# ----------------------------------------------------------------------------
# From here down we assume we are ON a prepared host (shared CPX21 by default).
# ----------------------------------------------------------------------------
[ -x "$BOOTSTRAP" ] || die "Cannot find bootstrap-tenant.sh at $BOOTSTRAP. Run this ON the Hetzner host where the bootstrap tooling lives."

VERTICAL_NAME="$VERTICAL"
VERTICAL_TAGLINE=""
VERTICAL_SKILLS_DIR="skills"
if [ -f "$VERTICAL_DIR/vertical.env" ]; then
    # shellcheck disable=SC1090
    . "$VERTICAL_DIR/vertical.env"
    [ -n "${VERTICAL_NAME:-}" ] || VERTICAL_NAME="$VERTICAL"
fi

log "Plan:"
log "  vertical        : $VERTICAL ($VERTICAL_NAME)"
log "  client-id       : $CLIENT_ID  (== tenant id)"
log "  subdomain       : $SUBDOMAIN"
log "  owner-email     : $OWNER_EMAIL"
log "  owner-telegram  : $OWNER_TELEGRAM (numeric)"
log "  reuses          : $BOOTSTRAP"

# ----------------------------------------------------------------------------
# Pre-flight: warn (not block) if DNS isn't pointing at the box yet.
# DNS is on Vercel and is a MANUAL prerequisite — we never automate it.
# ----------------------------------------------------------------------------
if command -v dig >/dev/null 2>&1; then
    RESOLVED=$(dig +short "$SUBDOMAIN" 2>/dev/null | tail -n1 || echo "")
    if [ "$RESOLVED" != "$HETZNER_IP" ]; then
        log "WARNING: $SUBDOMAIN resolves to '${RESOLVED:-<nothing>}', expected $HETZNER_IP."
        log "         Add the A record on VERCEL DNS first, or HTTPS cert issuance will fail."
        log "         (Tenant will still come up locally on its loopback port.)"
    else
        log "DNS OK: $SUBDOMAIN -> $HETZNER_IP"
    fi
else
    log "NOTE: 'dig' not available; cannot pre-check DNS. Ensure the Vercel A record exists."
fi

if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] would run: $BOOTSTRAP $CLIENT_ID $SUBDOMAIN $OWNER_EMAIL"
    log "[dry-run] would overlay vertical '$VERTICAL' + set Telegram allowlist [$OWNER_TELEGRAM]"
    exit 0
fi

# ----------------------------------------------------------------------------
# STEP 1 — call the existing provisioner. This is the heavy lifting:
# token gen, port allocation, compose render, openclaw.json (schema-clobber
# guard), corp roster, hermes-army, Caddy block, container up, healthcheck.
# We do NOT reimplement any of it.
# ----------------------------------------------------------------------------
log "STEP 1/3 — running bootstrap-tenant.sh (provision base tenant)..."
"$BOOTSTRAP" "$CLIENT_ID" "$SUBDOMAIN" "$OWNER_EMAIL"

# Resolve the tenant config dir bootstrap just wrote (same path scheme it uses).
TENANT_ROOT="/home/tagai/tenants/$CLIENT_ID"
TENANT_CONFIG="$TENANT_ROOT/.openclaw"
TENANT_WORKSPACE="$TENANT_ROOT/workspace"
[ -d "$TENANT_CONFIG" ] || die "Expected tenant config at $TENANT_CONFIG after bootstrap, not found."

# ----------------------------------------------------------------------------
# STEP 2 — overlay the vertical (system prompt + skills), tenant-parameterized.
# ----------------------------------------------------------------------------
log "STEP 2/3 — overlaying '$VERTICAL' vertical onto tenant $CLIENT_ID..."

TENANT_NAME=$(printf '%s' "$CLIENT_ID" | cut -c1 | tr '[:lower:]' '[:upper:]')$(printf '%s' "$CLIENT_ID" | cut -c2-)

# Same {{var}} substitution contract the bootstrap templates use.
render() {
    sed \
        -e "s|{{TENANT_ID}}|$CLIENT_ID|g" \
        -e "s|{{TENANT_NAME}}|$TENANT_NAME|g" \
        -e "s|{{OWNER_EMAIL}}|$OWNER_EMAIL|g" \
        -e "s|{{DOMAIN}}|$SUBDOMAIN|g" \
        -e "s|{{VERTICAL}}|$VERTICAL|g" \
        -e "s|{{VERTICAL_NAME}}|$VERTICAL_NAME|g" \
        "$1"
}

# 2a. System-prompt overlay -> tenant config, loaded at agent bootstrap.
if [ -f "$VERTICAL_DIR/system-prompt.overlay.md" ]; then
    render "$VERTICAL_DIR/system-prompt.overlay.md" > "$TENANT_CONFIG/vertical-system-prompt.md"
    log "  - wrote vertical-system-prompt.md"
fi

# 2b. Vertical skills -> tenant workspace skills dir (lives beside hermes-army).
SKILLS_SRC="$VERTICAL_DIR/${VERTICAL_SKILLS_DIR:-skills}"
if [ -d "$SKILLS_SRC" ]; then
    SKILLS_DST="$TENANT_WORKSPACE/.agents/skills/$VERTICAL"
    mkdir -p "$SKILLS_DST"
    for f in "$SKILLS_SRC"/*.md; do
        [ -e "$f" ] || continue
        render "$f" > "$SKILLS_DST/$(basename "$f")"
    done
    log "  - installed $VERTICAL skills into $SKILLS_DST"
fi

# 2c. Record which vertical this tenant is, for list/audit tooling.
cat > "$TENANT_CONFIG/vertical.json" <<EOF
{
  "vertical": "$VERTICAL",
  "verticalName": "$VERTICAL_NAME",
  "clientId": "$CLIENT_ID",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
log "  - wrote vertical.json"

# ----------------------------------------------------------------------------
# STEP 3 — wire the owner's Telegram numeric id into the tenant allowlist.
# bootstrap-tenant.sh enables the telegram channel but does NOT know the owner.
# We patch openclaw.json -> channels.telegram.allowFrom = [<numeric id>] so the
# tenant only answers its owner. Uses python3 (already required by bootstrap).
# ----------------------------------------------------------------------------
log "STEP 3/3 — setting Telegram owner allowlist [$OWNER_TELEGRAM]..."
OPENCLAW_JSON="$TENANT_CONFIG/openclaw.json"
if [ -f "$OPENCLAW_JSON" ] && command -v python3 >/dev/null 2>&1; then
    python3 - "$OPENCLAW_JSON" "$OWNER_TELEGRAM" <<'PY'
import json, sys
path, owner = sys.argv[1], sys.argv[2]
with open(path) as fh:
    cfg = json.load(fh)
tg = cfg.setdefault("channels", {}).setdefault("telegram", {})
tg["enabled"] = True
ids = [int(owner)]
# allowFrom is the owner allowlist; keep prior entries, ensure owner present.
prior = tg.get("allowFrom", [])
for x in prior:
    try:
        if int(x) not in ids:
            ids.append(int(x))
    except (TypeError, ValueError):
        pass
tg["allowFrom"] = ids
with open(path, "w") as fh:
    json.dump(cfg, fh, indent=2)
print("  - openclaw.json telegram.allowFrom = %s" % ids)
PY
    # Restart so the patched config + vertical overlay take effect.
    if command -v docker >/dev/null 2>&1; then
        log "  - restarting container to load vertical overlay + allowlist"
        ( cd "$TENANT_ROOT/openclaw" && docker compose up -d ) \
            || log "  - WARNING: 'docker compose up -d' did not restart cleanly; check 'docker logs openclaw-$CLIENT_ID-gateway'"
    fi
else
    log "  - WARNING: could not patch $OPENCLAW_JSON (missing file or python3). Set channels.telegram.allowFrom=[$OWNER_TELEGRAM] manually."
fi

# ----------------------------------------------------------------------------
# Post-deploy checklist
# ----------------------------------------------------------------------------
cat <<EOF

============================================================
 $VERTICAL_NAME Jarvis deployed for client: $CLIENT_ID
============================================================
  URL        : https://$SUBDOMAIN
  Owner      : $OWNER_EMAIL
  Telegram   : numeric id $OWNER_TELEGRAM (allowlisted)
  Vertical   : $VERTICAL ($VERTICAL_NAME)
  Container  : openclaw-$CLIENT_ID-gateway

  POST-DEPLOY CHECKLIST (human steps):
  [ ] VERCEL DNS: confirm A record  $SUBDOMAIN -> $HETZNER_IP  (manual, not automated)
  [ ] HTTPS live : curl -sf https://$SUBDOMAIN/ && echo OK   (cert needs DNS first)
  [ ] Telegram   : owner sends a message from the SAME numeric id ($OWNER_TELEGRAM)
                   that you passed. An @handle is NOT enough — the id must match.
  [ ] Pricing    : drop the owner's price sheet at
                   $TENANT_CONFIG/corp/pricing-construction.csv  (quotes need it)
  [ ] Smoke test : ask the bot "I need a quote for a kitchen remodel" -> intake fires
  [ ] Save token : the gateway token printed by bootstrap above — store in 1Password

  Tear down: $BOOTSTRAP_DIR/teardown-tenant.sh $CLIENT_ID
============================================================
EOF
