# Phase 3A — CLI Container Fix — 2026-04-26

## TL;DR
- Before: CLI `unhealthy` for 17 hours (orphaned network namespace from prior gateway recreate)
- Action: `docker compose up -d --no-build --force-recreate openclaw-cli`
- After: CLI `healthy` within ~5 seconds of recreate (first healthcheck probe at +5.1s passed, ExitCode 0)
- Gateway: still `healthy`, NOT recreated (uptime_started=2026-04-26T17:41:06Z, predates CLI recreate by ~13 min)
- Public healthz: 200 OK, `{"ok":true,"status":"live"}`

## Evidence

### Before
```
NAME                          IMAGE            COMMAND                  SERVICE            CREATED        STATUS                    PORTS
openclaw-openclaw-cli-1       openclaw:tagai   "node dist/index.js"     openclaw-cli       21 hours ago   Up 17 hours (unhealthy)   
openclaw-openclaw-gateway-1   openclaw:tagai   "docker-entrypoint.s…"   openclaw-gateway   21 hours ago   Up 13 minutes (healthy)   0.0.0.0:18789-18790->18789-18790/tcp, [::]:18789-18790->18789-18790/tcp
```
CLI inspect: `unhealthy | exit=0`

### Recreate action
```
 Container openclaw-openclaw-gateway-1 Running 
 Container openclaw-openclaw-cli-1 Recreate 
 Container openclaw-openclaw-cli-1 Recreated 
 Container openclaw-openclaw-cli-1 Starting 
 Container openclaw-openclaw-cli-1 Started
```
Gateway shows only "Running" — confirms it was NOT recreated, only the CLI was.

### After
```
NAME                          IMAGE            COMMAND                  SERVICE            CREATED          STATUS                    PORTS
openclaw-openclaw-cli-1       openclaw:tagai   "node dist/index.js"     openclaw-cli       32 seconds ago   Up 30 seconds (healthy)   
openclaw-openclaw-gateway-1   openclaw:tagai   "docker-entrypoint.s…"   openclaw-gateway   21 hours ago     Up 14 minutes (healthy)   0.0.0.0:18789-18790->18789-18790/tcp, [::]:18789-18790->18789-18790/tcp
```
CLI inspect: `healthy | restarts=0 | uptime_started=2026-04-26T17:54:47.45630067Z`
Gateway inspect: `healthy | uptime_started=2026-04-26T17:41:06.869367358Z`

Gateway uptime_started predates CLI uptime_started by 13m 41s, confirming gateway was untouched by this operation.

### Healthcheck log (post-fix)
```json
[{"Start":"2026-04-26T17:54:52.546796734Z","End":"2026-04-26T17:54:52.666121712Z","ExitCode":0,"Output":""}]
```
First healthcheck probe passed ~5.1s after container start, ExitCode 0, clean output.

### Public smoke test
```
$ curl -s --max-time 8 https://openclaw.ubntag.com/healthz
{"ok":true,"status":"live"}
```

## Root cause confirmation
The diagnosis from P2.1 is validated: forcing a recreate of the CLI container caused it to re-bind its `network_mode: service:openclaw-gateway` to the *current* gateway namespace, immediately resolving the unhealthy state. Zero code/image/config changes were required — the container's namespace pointer was simply stale.

## Recommendation for permanence (NOT done by this atom)
The structural bug is `network_mode: service:openclaw-gateway` in the CLI service WITHOUT a `restart: unless-stopped` policy or healthy-gateway dependency. Add this to the upstream docker-compose.yml or to a `docker-compose.override.yml`:

```yaml
services:
  openclaw-cli:
    restart: unless-stopped
    depends_on:
      openclaw-gateway:
        condition: service_healthy
```

This prevents future orphaning when the gateway is recreated. Compose will automatically re-bind the CLI to the new gateway namespace on gateway restart.
