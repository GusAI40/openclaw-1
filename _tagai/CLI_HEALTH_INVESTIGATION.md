# CLI Container Health Investigation — 2026-04-25

## Root cause (best hypothesis)

The CLI container is in a **stale `network_mode: container:<id>` reference**. Its config points at gateway container ID `bff3bfb226a2...`, but the CLI's actual network namespace inode (`4026532706`) does NOT match the gateway's current namespace (`4026532652`). The gateway has been recreated since the CLI was started, so the CLI now lives in its own empty/orphaned namespace where port 18789 is unreachable. The healthcheck `fetch('http://127.0.0.1:18789/healthz')` returns `ECONNREFUSED` because nothing is listening in the CLI's lonely namespace.

## Evidence

- **Healthcheck definition (CLI):** `["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18789/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]`, interval 180s, retries 3, start_period 15s. (Note: this is the IMAGE default; compose did not redeclare it for the CLI.)
- **Gateway healthcheck (compose-defined):** identical fetch URL, but interval 30s, retries 5, start_period 20s. Currently passing (`ExitCode: 0`).
- **Last 5 CLI healthcheck logs:** all `ExitCode: 1`, empty Output. Consistent timing (every 3 min). Failing since at least 17:32 UTC.
- **Manual reproduction inside CLI container:** `node -e "fetch('http://127.0.0.1:18789/healthz')..."` → `ERR fetch failed`. Native `http.get()` → `ECONNREFUSED 127.0.0.1:18789`. IPv6 also `ECONNREFUSED`.
- **Compare to gateway:** Same exact fetch from inside gateway container returns `{"ok":true,"status":"live"}`. Gateway is binding on port 18789 inside its own namespace and the CLI cannot see it.
- **Namespace divergence (definitive):** `docker inspect openclaw-openclaw-cli-1 .HostConfig.NetworkMode` = `container:bff3bfb226a2...` (the gateway container). But `readlink /proc/self/ns/net` returns different inodes for the two containers (gateway = `4026532652`, CLI = `4026532706`). They are NOT actually sharing a namespace despite the compose declaration.
- **CLI container started:** 2026-04-26T00:28:53Z. Gateway was last started later (it was recreated). When the CLI's referenced gateway container was replaced, Docker did not migrate the CLI to the new namespace.
- **CLI process state:** Running fine (`node dist/index.js`, PID 1 under docker-init, in interactive REPL). The container itself is healthy at the process level — only the networking is broken.
- **CLI startup log shows the symptom too:** First boot reported `Gateway: not reachable (ws://127.0.0.1:18789, local loopback)`. Later session output (probably after a manual recreate) showed `Gateway: reachable`. So this CLI process *did* once reach the gateway and has since been orphaned by a gateway restart.

## Recommended fix (atomic)

**Recreate the CLI container** so it re-resolves `network_mode: service:openclaw-gateway` to the current gateway container's namespace:

```
cd /home/tagai/openclaw && docker compose up -d --force-recreate openclaw-cli
```

(Or stop/start: `docker compose stop openclaw-cli && docker compose up -d openclaw-cli`.)

To prevent recurrence, add `restart: unless-stopped` to `openclaw-cli` in `docker-compose.yml` so it auto-restarts when the gateway is recreated. Currently only the gateway has a restart policy — the CLI does not, which is why a single gateway recreation permanently orphans the CLI's network until manual intervention.

## Risk

**Low.** Recreating the CLI container is config-only — no data is touched. The CLI's mounted volumes (`/home/node/.openclaw` and `/home/node/.openclaw/workspace`) survive container recreation. The interactive REPL session inside the CLI will be terminated, but that's already broken (gateway unreachable). No impact to gateway service or external clients on port 18789. Adding `restart: unless-stopped` is a benign compose edit.

## Raw outputs

### CLI container state
```
running | exit=0 | restarts=0 | started=2026-04-26T00:28:53.267983164Z
```

### CLI healthcheck definition (from image)
```json
{
  "Test": ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18789/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""],
  "Interval": 180000000000,
  "Timeout": 10000000000,
  "StartPeriod": 15000000000,
  "Retries": 3
}
```

### CLI healthcheck log (last 5)
```json
[
  {"Start":"2026-04-26T17:32:36.504Z","End":"2026-04-26T17:32:36.613Z","ExitCode":1,"Output":""},
  {"Start":"2026-04-26T17:35:36.614Z","End":"2026-04-26T17:35:36.716Z","ExitCode":1,"Output":""},
  {"Start":"2026-04-26T17:38:36.717Z","End":"2026-04-26T17:38:36.840Z","ExitCode":1,"Output":""},
  {"Start":"2026-04-26T17:41:36.840Z","End":"2026-04-26T17:41:36.959Z","ExitCode":1,"Output":""},
  {"Start":"2026-04-26T17:44:36.963Z","End":"2026-04-26T17:44:37.070Z","ExitCode":1,"Output":""}
]
```

### Gateway healthcheck (passing)
```json
{
  "Status":"healthy","FailingStreak":0,
  "Log":[
    {"Start":"2026-04-26T17:45:02.303Z","End":"2026-04-26T17:45:02.436Z","ExitCode":0,"Output":""},
    {"Start":"2026-04-26T17:47:02.796Z","End":"2026-04-26T17:47:02.920Z","ExitCode":0,"Output":""}
  ]
}
```

### Container CMD comparison
```
GATEWAY-CMD:  [node dist/index.js gateway --bind lan --port 18789]
CLI-CMD:      []
CLI-ENTRYPOINT: ["node","dist/index.js"]   (interactive REPL — no subcommand)
CLI tty=true, stdin_open=true
```

### Compose file (relevant excerpts)
```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE:-openclaw:local}
    ports:
      - "${OPENCLAW_GATEWAY_PORT:-18789}:18789"
      - "${OPENCLAW_BRIDGE_PORT:-18790}:18790"
    restart: unless-stopped     # <-- has restart policy
    command: [node, dist/index.js, gateway, --bind, lan, --port, 18789]
    healthcheck: { test: [CMD, node, -e, "fetch('http://127.0.0.1:18789/healthz')..."], interval: 30s, retries: 5, start_period: 20s }

  openclaw-cli:
    image: ${OPENCLAW_IMAGE:-openclaw:local}
    network_mode: "service:openclaw-gateway"     # <-- shares network namespace
    cap_drop: [NET_RAW, NET_ADMIN]
    security_opt: [no-new-privileges:true]
    stdin_open: true
    tty: true
    entrypoint: [node, dist/index.js]
    depends_on: [openclaw-gateway]
    # NOTE: no restart policy — does not auto-recover when gateway is recreated
```

### Compose override
```yaml
services:
  openclaw-gateway:
    env_file: [/home/tagai/openclaw/.env]
  openclaw-cli:
    env_file: [/home/tagai/openclaw/.env]
```

### .env (secrets filtered)
```
OPENCLAW_IMAGE=openclaw:tagai
OPENCLAW_TZ=America/Chicago
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=
OPENCLAW_CONFIG_DIR=/home/tagai/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/tagai/.openclaw/workspace
XDG_CONFIG_HOME=/home/node/.openclaw
CLAUDE_WEB_COOKIE=
```

### Cross-container reachability tests
```
# Gateway → its own healthz (loopback, inside gateway namespace):
{"ok":true,"status":"live"}

# CLI → gateway by service name (DNS):
cli cannot reach gateway by name

# CLI → 127.0.0.1:18789 (should be same namespace as gateway):
cli cannot reach 127.0.0.1:18789

# CLI Node fetch to localhost:
ERR fetch failed

# CLI native http.get IPv4:
ERR ECONNREFUSED connect ECONNREFUSED 127.0.0.1:18789

# CLI fetch IPv6 [::1]:
ERR6 fetch failed ECONNREFUSED
```

### Network namespace inodes (definitive proof of mismatch)
```
GATEWAY namespace: net:[4026532652]
CLI namespace:     net:[4026532706]
CLI HostConfig.NetworkMode: container:bff3bfb226a26fb5d9d23df040e206b9f4b4de468089869c7a44fb5213bbc4fc
GW HostConfig.NetworkMode:  openclaw_default
```

The CLI's compose-declared `network_mode: service:openclaw-gateway` resolved at start-time to the gateway container ID `bff3bfb...`. That gateway container has since been recreated, so the namespace inode no longer matches. The CLI is stranded.

### CLI process inventory
```
UID    PID  PPID  C STIME TTY      TIME CMD
node     1     0  0 Apr25 pts/0   0:02 /sbin/docker-init -- node dist/index.js
node     7     1  0 Apr25 pts/0   0:07 node dist/index.js
```

CLI is alive and running the interactive REPL. Only its network is broken.
