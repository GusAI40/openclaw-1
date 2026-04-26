# Hetzner Preflight — 2026-04-25

## TL;DR
- **Coolify network name:** N/A — **Coolify is NOT installed on this server** (was assumed: `coolify`)
- **Cert resolver name:** N/A — **No Traefik. Caddy on the HOST (not Docker) handles TLS via Let's Encrypt auto-cert** (was assumed: `letsencrypt`)
- **/home/tagai/.openclaw exists:** YES (already populated — agents/, credentials/, workspace/, openclaw.json, etc.)
- **/home/tagai/.tagai-env exists:** YES (2901 bytes, includes VAPI section)
- **DNS for openclaw.ubntag.com:** RESOLVES to 87.99.148.242 (already configured, A record live)
- **Server health:** WARNING — Mem 3.2Gi/3.7Gi used (553Mi available), Disk 56G/75G (78% used), 213 logged-in users (unusual — probably stale tmux/ssh sessions). Uptime 1d 10h. Load 1.12 (on 3 vCPU = ~37%, fine).
- **Existing TAG containers:** 5 running — `openclaw-openclaw-cli-1` (UNHEALTHY), `openclaw-openclaw-gateway-1` (healthy), `michelle-fb-poster`, `michelle-fb-webhook`, `michelle-fb-dashboard`

## CRITICAL FINDING: OpenClaw is ALREADY DEPLOYED on this server

This is NOT a fresh deploy. Two openclaw containers are already running from a previous session:
- `openclaw-openclaw-gateway-1` listening on `localhost:18789` (handled by Caddy)
- `openclaw-openclaw-cli-1` — currently **unhealthy** — needs investigation
- VAPI webhook path `/vapi/webhook` and `/vapi/tool` proxied to `127.0.0.1:18792`
- Reverse proxy: Caddy (host service, not container) at `/etc/caddy/Caddyfile`
- Repository at `/home/tagai/openclaw/` (with full source tree, package.json, docker-compose.yml)
- Network: `openclaw_default` (Docker Compose default, NOT a shared coolify network)

The `docker-compose.tagai.yml` overlay assumes a Coolify+Traefik stack that does not exist here.

## Required Updates to docker-compose.tagai.yml

The original overlay was written for a hypothetical Coolify deployment. This server uses a different stack — the overlay needs a complete rethink, OR we use the existing already-deployed setup:

- **REMOVE** any `networks.coolify.external: true` declarations — there is no `coolify` network
- **REMOVE** all Traefik labels (`traefik.enable`, `traefik.http.routers.*.tls.certresolver=letsencrypt`, etc.) — there is no Traefik
- **ADD** mapping to the existing `openclaw_default` network if joining the running stack, OR create a fresh isolated stack
- **TLS strategy:** Add a Caddy block in `/etc/caddy/Caddyfile` (already done for `openclaw.ubntag.com`) instead of cert resolver labels
- **Port binding:** Bind to `127.0.0.1:<port>` (loopback) since Caddy proxies from host, not from a Docker network

## Action Items for Deploy Phase

1. **Decide:** Do we redeploy from scratch (down + up with new compose) or attach to the existing running stack? The cli-1 container is unhealthy — leaning toward redeploy.
2. **Investigate** why `openclaw-openclaw-cli-1` is unhealthy (`docker logs openclaw-openclaw-cli-1 --tail 100`).
3. **Disk pressure:** 78% full. Run `docker system prune -af --volumes` ONLY after confirming no in-use volumes — or at minimum prune dangling images.
4. **Memory pressure:** 553Mi available with no swap. Adding ANY new container risks OOM. Consider:
   - Add 2GB swap file before deploying anything new
   - OR pause/stop unused containers
5. **213 stale sessions:** `who | wc -l` shows 213 users — likely abandoned ssh/tmux. Worth cleaning (`pkill -u tagai -t pts/<n>`) to free tiny amounts of memory and reduce attack surface.
6. **DNS:** Already done. `openclaw.ubntag.com` → 87.99.148.242. No action.
7. **Caddy config for openclaw is already in place** with VAPI webhook routing. Reuse it.
8. **Document the actual stack** in `_tagai/CLAUDE.md` — earlier agent's mental model (Coolify+Traefik) was wrong.

## Raw Outputs

### Server health
```
 17:38:27 up 1 day, 10:11, 213 users,  load average: 1.12, 0.48, 0.18
---
               total        used        free      shared  buff/cache   available
Mem:           3.7Gi       3.2Gi       169Mi       6.1Mi       683Mi       553Mi
Swap:             0B          0B          0B
---
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        75G   56G   16G  78% /
---
Linux tagai-cloud 6.8.0-90-generic #91-Ubuntu SMP PREEMPT_DYNAMIC Tue Nov 18 14:14:30 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux
```

### Networks
```
NETWORK ID     NAME               DRIVER    SCOPE
6eaaa3882aca   bridge             bridge    local
de8b09fe1506   hetzner_default    bridge    local
60fe50c65eed   host               host      local
e886db6cdcdc   none               null      local
aa15dde9f552   openclaw_default   bridge    local
```
(No `coolify`, no `traefik-proxy`, no shared external network.)

### Reverse proxy
```
docker ps -a | grep -iE 'traefik|caddy|nginx|proxy' → NO REVERSE PROXY CONTAINERS FOUND
ss -tlnp on :80/:443 → caddy (host process, PID 6128)
```

### openclaw_default network membership
```json
{
  "bff3bfb226a26fb5d9d23df040e206b9f4b4de468089869c7a44fb5213bbc4fc": {
    "Name": "openclaw-openclaw-gateway-1",
    "IPv4Address": "172.19.0.2/16"
  }
}
```
(Only gateway is on this network. cli container appears to be on host network or its own.)

### Caddyfile entry for openclaw.ubntag.com
```
openclaw.ubntag.com {
    @vapi path /vapi/webhook /vapi/webhook/* /vapi/tool /vapi/tool/*
    handle @vapi {
        reverse_proxy 127.0.0.1:18792
    }
    handle {
        reverse_proxy localhost:18789
        header {
            Strict-Transport-Security "max-age=31536000; includeSubDomains"
            X-Content-Type-Options "nosniff"
            X-Frame-Options "DENY"
        }
    }
}
```

### /home/tagai/
```
total 48
drwxr-x---  8 tagai tagai 4096 Apr 25 16:01 .
drwxr-xr-x  3 root  root  4096 Apr 25 10:49 ..
-rw-r--r--  1 tagai tagai  220 Mar 31  2024 .bash_logout
-rw-r--r--  1 tagai tagai 3771 Mar 31  2024 .bashrc
drwx------  2 tagai tagai 4096 Apr 25 10:49 .cache
drwxr-xr-x  3 tagai tagai 4096 Apr 25 10:53 clients
drwx------  3 tagai tagai 4096 Apr 25 11:05 .docker
drwx------ 16 tagai tagai 4096 Apr 26 14:35 .openclaw
drwxrwxr-x 23 tagai tagai 4096 Apr 25 18:27 openclaw
drwx------  2 tagai tagai 4096 Apr 25 11:04 .ssh
-rw-------  1 tagai tagai 2901 Apr 26 16:12 .tagai-env
```

### /home/tagai/.openclaw/
```
agents/ canvas/ credentials/ devices/ exec-approvals.json extensions/ identity/
jarvis-vapi/ logs/ maya-vapi/ memory/ openclaw.json (+5 backups) openclaw.json.last-good
plugin-runtime-deps/ tasks/ telegram/ update-check.json workspace/
```

### .tagai-env (first line — confirmed exists)
```
# ── VAPI ──────────────────────────────────────────────────────────────────────
```

### Existing containers
```
NAMES                         IMAGE                          STATUS
michelle-fb-webhook           michelle-fb-poster:latest      Up 38 seconds (healthy)
michelle-fb-poster            michelle-fb-poster:latest      Up 38 seconds (healthy)
openclaw-openclaw-cli-1       openclaw:tagai                 Up 17 hours (unhealthy)
openclaw-openclaw-gateway-1   openclaw:tagai                 Up 17 hours (healthy)
michelle-fb-dashboard         michelle-fb-dashboard:latest   Up 30 hours (healthy)
```

### DNS
```
$ nslookup openclaw.ubntag.com 1.1.1.1
Server:  one.one.one.one
Address: 1.1.1.1
Non-authoritative answer:
Name:    openclaw.ubntag.com
Address: 87.99.148.242
```

### Coolify config search
```
ls /data/coolify    → not found
ls ~/coolify        → not found
ls /root/coolify    → not found
which coolify       → not found
```
Coolify is definitively NOT installed.
