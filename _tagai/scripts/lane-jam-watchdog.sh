#!/usr/bin/env bash
# lane-jam-watchdog.sh — auto-recover a wedged agent:main:main lane (R-2).
#
# Background: a long tool chain or a model-failover loop can wedge the
# agent:main:main lane in state=processing. Telegram messages then queue behind
# it forever (hit Julian twice + Gus once, May 2026). The runtime DETECTS this
# (emits "[diagnostic] stuck session ...") but does NOT auto-recover. This
# watchdog automates the manual fix: archive the stuck session, restart the
# gateway to free the lane.
#
# Detection uses the runtime's OWN verdict (the diagnostic log line), filtered to
# real jams: queueDepth>=1 (messages waiting) AND age>=ACT_AGE (above any legit
# long task incl. ~5-min Veo renders), confirmed across 2 consecutive runs.
#
# Safety: kill-switch file, cooldown, archive (never delete), full logging,
# DRYRUN mode. Runs as the `tagai` user via cron (every 3 min).
set -uo pipefail

# cron runs with a minimal PATH; ensure docker + coreutils resolve
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WD=/home/tagai/.openclaw/watchdog
LOG="$WD/watchdog.log"
KILL="$WD/DISABLED"
mkdir -p "$WD/quarantine"

ACT_AGE=${ACT_AGE:-600}        # act only if stuck >= 10 min
COOLDOWN=${COOLDOWN:-1200}     # no second recovery within 20 min
LOG_WINDOW=${LOG_WINDOW:-6m}   # how far back to scan container logs
DRYRUN=${DRYRUN:-0}            # 1 = log what it would do, take no action

log(){ echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

# simple rotation: keep the log from growing unbounded
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5000000 ]; then
  mv "$LOG" "$LOG.1"
fi

log "run start (dryrun=$DRYRUN window=$LOG_WINDOW act_age=${ACT_AGE}s)"

if [ -f "$KILL" ]; then log "disabled (kill-switch $KILL present); skip"; exit 0; fi

# name|container|composeDir|configDir
TENANTS=(
  "gus|openclaw-openclaw-gateway-1|/home/tagai/openclaw|/home/tagai/.openclaw"
  "julian|openclaw-julian-gateway|/home/tagai/tenants/julian/openclaw|/home/tagai/tenants/julian/.openclaw"
)

for row in "${TENANTS[@]}"; do
  IFS='|' read -r name container composeDir configDir <<< "$row"
  state="$WD/state-$name.txt"
  cdfile="$WD/cooldown-$name.txt"

  if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
    log "[$name] container not running; skip"; continue
  fi

  line=$(docker logs --since "$LOG_WINDOW" "$container" 2>&1 \
    | grep -oE 'stuck session: sessionId=[^ ]+ sessionKey=agent:main:main state=processing age=[0-9]+s queueDepth=[0-9]+' \
    | tail -1)

  if [ -z "$line" ]; then
    log "[$name] lane clear"
    [ -f "$state" ] && rm -f "$state"
    continue
  fi

  sid=$(echo "$line" | sed -E 's/.*sessionId=([^ ]+) .*/\1/')
  age=$(echo "$line" | sed -E 's/.*age=([0-9]+)s.*/\1/')
  qd=$(echo  "$line" | sed -E 's/.*queueDepth=([0-9]+).*/\1/')

  log "[$name] stuck signal: sid=$sid age=${age}s queueDepth=$qd"

  # only real jams: messages waiting AND past the action threshold
  if [ "${qd:-0}" -lt 1 ] || [ "${age:-0}" -lt "$ACT_AGE" ]; then
    log "[$name] below action criteria (qd=$qd age=$age); record only"
    echo "$sid" > "$state"; continue
  fi

  # require the SAME session flagged in the previous run (2-reading confirm)
  prev=$(cat "$state" 2>/dev/null || echo "")
  echo "$sid" > "$state"
  if [ "$prev" != "$sid" ]; then
    log "[$name] 1st confirmed reading for $sid; wait for 2nd run"; continue
  fi

  # cooldown
  now=$(date +%s); last=$(cat "$cdfile" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$COOLDOWN" ]; then
    log "[$name] in cooldown ($((now-last))s < $COOLDOWN); skip"; continue
  fi

  if [ "$DRYRUN" = "1" ]; then
    log "[$name] DRYRUN: would archive $sid and restart gateway (confirmed jam)"; continue
  fi

  # --- RECOVER ---
  ts=$(date -u +%Y%m%d-%H%M%S)
  qdir="$WD/quarantine/$name-$ts-$sid"
  mkdir -p "$qdir"
  moved=$(find "$configDir/agents/main/sessions" -maxdepth 1 -name "$sid*" 2>/dev/null | wc -l)
  if [ "$moved" -gt 0 ]; then
    mv "$configDir"/agents/main/sessions/"$sid"* "$qdir"/ 2>/dev/null
    log "[$name] archived $moved file(s) for $sid -> $qdir"
  else
    log "[$name] no session files matched $sid (restart-only recovery)"
  fi
  log "[$name] RECOVER: docker compose restart in $composeDir"
  ( cd "$composeDir" && docker compose restart ) >> "$LOG" 2>&1
  echo "$now" > "$cdfile"
  rm -f "$state"
  log "[$name] RECOVER done"
done
