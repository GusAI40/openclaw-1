#!/bin/bash
# list-tenants.sh — Print all active tenants with status.

set -euo pipefail

TENANT_ROOT_BASE="/home/tagai/tenants"

if [[ ! -d "$TENANT_ROOT_BASE" ]]; then
    echo "No tenants directory found at $TENANT_ROOT_BASE."
    exit 0
fi

printf '%-20s %-32s %-8s %-8s %-12s  %s\n' "TENANT_ID" "DOMAIN" "GW_PORT" "BR_PORT" "STATUS" "LAST_LOG"
printf '%-20s %-32s %-8s %-8s %-12s  %s\n' "---------" "------" "-------" "-------" "------" "--------"

found_any=0
for tdir in "$TENANT_ROOT_BASE"/*/; do
    [[ -d "$tdir" ]] || continue
    tid="$(basename "$tdir")"
    # Skip archived/removed
    [[ "$tid" =~ \.removed- ]] && continue
    found_any=1

    env_file="${tdir}openclaw/.env"
    domain="-"
    gw_port="-"
    br_port="-"
    if [[ -f "$env_file" ]]; then
        domain="$(grep -E '^DOMAIN=' "$env_file" 2>/dev/null | cut -d= -f2- || echo -)"
        gw_port="$(grep -E '^OPENCLAW_GATEWAY_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- || echo -)"
        br_port="$(grep -E '^OPENCLAW_BRIDGE_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- || echo -)"
    fi

    # Container status
    status="STOPPED"
    if docker ps --format '{{.Names}}\t{{.State}}\t{{.Status}}' 2>/dev/null \
        | grep -q "^openclaw-${tid}-gateway"; then
        cs="$(docker inspect --format='{{.State.Health.Status}}' "openclaw-${tid}-gateway" 2>/dev/null || echo unknown)"
        case "$cs" in
            healthy) status="HEALTHY" ;;
            starting) status="STARTING" ;;
            unhealthy) status="UNHEALTHY" ;;
            *) status="RUNNING" ;;
        esac
    elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^openclaw-${tid}-gateway$"; then
        status="EXITED"
    fi

    # Last log line
    last_log="-"
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^openclaw-${tid}-gateway$"; then
        last_log="$(docker logs --tail=1 "openclaw-${tid}-gateway" 2>&1 | tr -d '\n' | cut -c1-60)"
    fi

    printf '%-20s %-32s %-8s %-8s %-12s  %s\n' \
        "$tid" "$domain" "$gw_port" "$br_port" "$status" "$last_log"
done

if [[ $found_any -eq 0 ]]; then
    echo "(no tenants provisioned yet)"
fi
