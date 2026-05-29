#!/bin/sh
# preflight-paid-tenant.sh - read-only paid-tenant launch gate.
#
# Single responsibility: verify that a sold client can be launched safely.
# This script must not create tenants, edit DNS, write secrets, patch configs, or
# restart services. It only inspects current state and exits nonzero on hard
# launch blockers.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TAGAI_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../" && pwd)
VERTICALS_DIR="$SCRIPT_DIR/../verticals"

EXPECTED_IP="87.99.148.242"
BACKUP_DIR="/home/tagai/.openclaw/backups"
AGE_KEY="/home/tagai/.openclaw/backups/.age-key.txt"
TENANTS_DIR="/home/tagai/tenants"

VERTICAL=""
CLIENT_ID=""
SUBDOMAIN=""
OWNER_EMAIL=""
OWNER_TELEGRAM=""

FAILS=0
WARNS=0

usage() {
    sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'
    cat <<EOF

Usage:
  ./preflight-paid-tenant.sh \\
    --vertical construction \\
    --client-id acme-builders \\
    --subdomain acme-builders.ubntag.com \\
    --owner-email owner@acme.com \\
    --owner-telegram 123456789 \\
    [--expected-ip 87.99.148.242]

EOF
    exit "${1:-2}"
}

pass() { printf '[PASS] %s\n' "$*"; }
warn() { WARNS=$((WARNS + 1)); printf '[WARN] %s\n' "$*"; }
fail() { FAILS=$((FAILS + 1)); printf '[FAIL] %s\n' "$*"; }
info() { printf '[INFO] %s\n' "$*"; }

while [ $# -gt 0 ]; do
    case "$1" in
        --vertical)        VERTICAL="${2:-}"; shift 2 ;;
        --client-id)       CLIENT_ID="${2:-}"; shift 2 ;;
        --subdomain)       SUBDOMAIN="${2:-}"; shift 2 ;;
        --owner-email)     OWNER_EMAIL="${2:-}"; shift 2 ;;
        --owner-telegram)  OWNER_TELEGRAM="${2:-}"; shift 2 ;;
        --expected-ip)     EXPECTED_IP="${2:-}"; shift 2 ;;
        -h|--help)         usage 0 ;;
        *)                 fail "Unknown arg: $1"; usage 2 ;;
    esac
done

printf '\nBusiness-in-a-Box paid-tenant preflight\n'
printf 'client-id=%s vertical=%s subdomain=%s expected-ip=%s\n\n' \
    "${CLIENT_ID:-<missing>}" "${VERTICAL:-<missing>}" "${SUBDOMAIN:-<missing>}" "$EXPECTED_IP"

# Required arguments and stable local contracts.
[ -n "$VERTICAL" ] || fail "--vertical is required"
[ -n "$CLIENT_ID" ] || fail "--client-id is required"
[ -n "$SUBDOMAIN" ] || fail "--subdomain is required"
[ -n "$OWNER_EMAIL" ] || fail "--owner-email is required"
[ -n "$OWNER_TELEGRAM" ] || fail "--owner-telegram is required"

if [ -n "$CLIENT_ID" ]; then
    if printf '%s' "$CLIENT_ID" | grep -Eq '^[a-z][a-z0-9-]{2,31}$'; then
        pass "client-id matches tenant id contract"
    else
        fail "client-id must be lowercase, start with a letter, 3-32 chars, [a-z0-9-]"
    fi
fi

if [ -n "$OWNER_EMAIL" ]; then
    if printf '%s' "$OWNER_EMAIL" | grep -Eq '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'; then
        pass "owner email has a valid basic shape"
    else
        fail "owner email does not look valid"
    fi
fi

if [ -n "$OWNER_TELEGRAM" ]; then
    if printf '%s' "$OWNER_TELEGRAM" | grep -Eq '^[0-9]+$'; then
        pass "owner Telegram id is numeric"
    else
        fail "owner Telegram id must be digits only, not @username or label"
    fi
fi

if [ -n "$VERTICAL" ]; then
    if [ -d "$VERTICALS_DIR/$VERTICAL" ]; then
        pass "vertical exists: $VERTICAL"
    else
        fail "unknown vertical '$VERTICAL' in $VERTICALS_DIR"
    fi
fi

if [ -x "$TAGAI_DIR/bootstrap/bootstrap-tenant.sh" ]; then
    pass "bootstrap provisioner exists and is executable"
else
    fail "bootstrap provisioner missing or not executable: $TAGAI_DIR/bootstrap/bootstrap-tenant.sh"
fi

# DNS is a paid-launch blocker because Caddy cert issuance depends on it.
if [ -n "$SUBDOMAIN" ]; then
    RESOLVED=""
    if command -v dig >/dev/null 2>&1; then
        RESOLVED=$(dig +short "$SUBDOMAIN" A 2>/dev/null | tail -n1 || true)
    elif command -v getent >/dev/null 2>&1; then
        RESOLVED=$(getent ahostsv4 "$SUBDOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)
    else
        warn "no dig/getent available; DNS cannot be verified on this host"
    fi

    if [ -n "$RESOLVED" ]; then
        if [ "$RESOLVED" = "$EXPECTED_IP" ]; then
            pass "DNS resolves correctly: $SUBDOMAIN -> $RESOLVED"
        else
            fail "DNS resolves to $RESOLVED, expected $EXPECTED_IP"
        fi
    elif command -v dig >/dev/null 2>&1 || command -v getent >/dev/null 2>&1; then
        fail "DNS does not resolve for $SUBDOMAIN"
    fi
fi

# Host services.
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        pass "Docker is available"
    else
        fail "Docker command exists but daemon is not reachable"
    fi
else
    fail "Docker is not installed or not in PATH"
fi

if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet caddy; then
        pass "Caddy is active"
    else
        fail "Caddy is not active"
    fi
else
    warn "systemctl unavailable; Caddy state not verified"
fi

# Docker direct exposure gate. Paid tenants should enter through Caddy only.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps -q | grep -q .; then
        PORTS_TMP=$(mktemp)
        docker inspect --format '{{.Name}}	{{json .NetworkSettings.Ports}}' $(docker ps -q) > "$PORTS_TMP"
        if python3 - "$CLIENT_ID" "$PORTS_TMP" <<'PY'
import json
import sys

target = sys.argv[1]
path = sys.argv[2]
bad = []
with open(path, "r", encoding="utf-8") as fh:
  lines = fh.readlines()
for raw in lines:
    raw = raw.rstrip("\n")
    if not raw:
        continue
    name, _, ports_json = raw.partition("\t")
    try:
        ports = json.loads(ports_json) if ports_json else {}
    except json.JSONDecodeError:
        bad.append(f"{name}: could not parse published port metadata")
        continue
    for container_port, bindings in (ports or {}).items():
        for binding in bindings or []:
            host_ip = binding.get("HostIp", "")
            host_port = binding.get("HostPort", "")
            if host_ip in ("127.0.0.1", "::1"):
                continue
            bad.append(f"{name}: {host_ip or '<all>'}:{host_port}->{container_port}")

if bad:
    print("[FAIL] Docker containers expose raw public ports:")
    for item in bad:
        print("       " + item)
    sys.exit(1)
print("[PASS] Docker published ports are loopback-only")
PY
        then
            :
        else
            FAILS=$((FAILS + 1))
        fi
        rm -f "$PORTS_TMP"
    else
        warn "no running Docker containers found"
    fi
fi

# Backup evidence and restoreability checks without extracting secrets.
if [ -d "$BACKUP_DIR" ]; then
    pass "backup directory exists"
    LATEST_BACKUP=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name 'backup-*' | sort | tail -n1 || true)
    if [ -n "$LATEST_BACKUP" ]; then
        pass "latest backup found: $(basename "$LATEST_BACKUP")"

        for required in MANIFEST.txt memory.sqlite runtime-configs.tar.gz bootstrap-template.tar.gz hindsight.tar.gz; do
            if [ -f "$LATEST_BACKUP/$required" ]; then
                pass "backup contains $required"
            else
                fail "latest backup missing $required"
            fi
        done

        for archive in runtime-configs.tar.gz bootstrap-template.tar.gz hindsight.tar.gz; do
            if [ -f "$LATEST_BACKUP/$archive" ]; then
                if tar -tzf "$LATEST_BACKUP/$archive" >/dev/null 2>&1; then
                    pass "archive lists cleanly: $archive"
                else
                    fail "archive is not listable: $archive"
                fi
            fi
        done

        if [ -f "$LATEST_BACKUP/memory.sqlite" ]; then
            if command -v sqlite3 >/dev/null 2>&1; then
                SQLITE_RESULT=$(sqlite3 "$LATEST_BACKUP/memory.sqlite" 'PRAGMA integrity_check;' 2>/dev/null || true)
                if [ "$SQLITE_RESULT" = "ok" ]; then
                    pass "memory.sqlite integrity_check ok"
                else
                    fail "memory.sqlite integrity_check returned '${SQLITE_RESULT:-<no output>}'"
                fi
            else
                warn "sqlite3 unavailable; memory.sqlite integrity not checked"
            fi
        fi
    else
        fail "no backup-* directories found in $BACKUP_DIR"
    fi
else
    fail "backup directory missing: $BACKUP_DIR"
fi

if [ -f "$AGE_KEY" ]; then
    pass "age backup key exists"
    KEY_MODE=$(stat -c '%a' "$AGE_KEY" 2>/dev/null || echo "")
    case "$KEY_MODE" in
        400|440|600|640) pass "age key permissions are restricted ($KEY_MODE)" ;;
        "") warn "could not inspect age key permissions" ;;
        *) fail "age key permissions are too broad ($KEY_MODE)" ;;
    esac
else
    fail "age backup key missing: $AGE_KEY"
fi

# Existing tenant checks. These are warnings before first deploy, blockers once
# the tenant exists and should be production-ready.
TENANT_CONFIG="$TENANTS_DIR/$CLIENT_ID/.openclaw"
if [ -n "$CLIENT_ID" ] && [ -d "$TENANT_CONFIG" ]; then
    pass "tenant config exists for $CLIENT_ID"
    OPENCLAW_JSON="$TENANT_CONFIG/openclaw.json"
    if [ -f "$OPENCLAW_JSON" ] && command -v python3 >/dev/null 2>&1; then
        if python3 - "$OPENCLAW_JSON" "$OWNER_TELEGRAM" <<'PY'
import json
import sys

path, owner = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as fh:
    cfg = json.load(fh)
allow = cfg.get("channels", {}).get("telegram", {}).get("allowFrom", [])
allow_s = {str(x) for x in allow}
if owner in allow_s:
    print("[PASS] tenant Telegram allowlist contains owner id")
else:
    print("[FAIL] tenant Telegram allowlist does not contain owner id")
    sys.exit(1)
PY
        then
            :
        else
            FAILS=$((FAILS + 1))
        fi
    else
        fail "tenant openclaw.json missing or python3 unavailable"
    fi
else
    warn "tenant config not present yet; allowlist will be verified after deploy"
fi

if crontab -l 2>/dev/null | grep -Eiq 'auto-approve|auto approve'; then
    warn "auto-approve cron text detected; do not use auto-pairing for paid tenants"
fi

printf '\nPreflight summary: %s fail(s), %s warning(s)\n' "$FAILS" "$WARNS"
if [ "$FAILS" -gt 0 ]; then
    printf 'RESULT: BLOCKED\n'
    exit 1
fi

printf 'RESULT: PASS\n'
