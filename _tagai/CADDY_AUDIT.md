# Caddy Audit — 2026-04-26

## TL;DR
- Caddy version: **v2.11.2** (PID 6128, active 1d 6h, systemd-managed)
- Caddyfile path: **`/etc/caddy/Caddyfile`**
- `openclaw.ubntag.com` routing: VAPI paths (`/vapi/webhook*`, `/vapi/tool*`) -> `127.0.0.1:18792`; everything else (default `handle`) -> `localhost:18789` (gateway)
- HTTPS reachable from internet: **YES** — `/healthz` returns `200 OK` with `{"ok":true,"status":"live"}`
- Cert status: **ISSUED** — Let's Encrypt cert present at `/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/openclaw.ubntag.com/` (`.crt`, `.key`, `.json`)
- Gateway healthz from internet: **`{"ok":true,"status":"live"}` (200 OK)** — fully functional end-to-end

## openclaw.ubntag.com block (verbatim from Caddyfile)
```
# OpenClaw — TAG AI gateway (added 2026-04-25)
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

## What this means for our deploy
- **We do NOT need Coolify, Traefik, or new TLS infrastructure** — Caddy already handles it cleanly.
- **The `_tagai/docker-compose.tagai.yml` Traefik labels are dead weight; remove them.** Caddy on the host is the reverse proxy; containers just bind to `127.0.0.1:<port>` (or via docker-proxy as 18789/18790 already do) and Caddy proxies in.
- **Routing is already correct for OpenClaw.** The default `handle` block sends every non-VAPI path to `localhost:18789`, which is the gateway. The gateway's `/healthz` is reachable via `https://openclaw.ubntag.com/healthz` right now.
- **VAPI webhook is isolated** to a separate handler going to a different process (`127.0.0.1:18792`, currently a Node process). This is sound separation — VAPI calls never touch the gateway.
- **No path-matcher changes needed.** The current config is exactly what we want: gateway at `/`, VAPI at `/vapi/*`.

## Other Caddy-managed domains (informational)
| Domain | Backend | Purpose |
|---|---|---|
| `voiceai.ubntag.com` (HTTP + HTTPS) | `localhost:3000` (Node `/opt/voice...`) | Voice AI / Maya UI |
| `http://87.99.148.242` | `localhost:3000` | Diagnostic direct-IP path (no DNS) |
| `michelle-fb.ubntag.com` | `localhost:8000` | Michelle FB Group Poster webhook (mobile trigger), `tls internal` |
| `michelle-fb-status.ubntag.com` | `localhost:8001` | Michelle FB read-only dashboard PWA, `tls internal` |
| `openclaw.ubntag.com` | `localhost:18789` (default) + `127.0.0.1:18792` (VAPI) | TAG AI gateway + VAPI webhook |

Notes:
- `(common)` snippet bundles `reverse_proxy localhost:3000` + standard security headers — used by voiceai blocks only.
- Two domains (`michelle-fb*`) use `tls internal` (self-signed via Caddy's internal CA), the rest use Let's Encrypt automatically.
- Caddy listens on `*:80` and `*:443` (PID 6128) — exclusive owner of public TLS termination on this host.

## Recommended changes (atomic)
**No Caddyfile changes required for OpenClaw to work.** The current config already routes correctly.

The only potential follow-up (not now, separate phase) is a documentation note in the `_tagai/` repo:

- **File:** `C:\Users\gsanc\TAG-Projects-2026\openclaw\_tagai\docker-compose.tagai.yml`
- **What to change:** Strip Traefik `labels:` blocks from any service definitions; replace with comment "Caddy on host handles TLS/proxy — see /etc/caddy/Caddyfile"
- **Why:** Avoid future confusion where a teammate adds Traefik thinking it's needed; the host already terminates TLS for `*.ubntag.com`.

## Risks
**Low.** Caddy is stable, configured correctly, certs are issued, end-to-end test (curl from laptop -> gateway healthz) is green. No drift, no expiring certs, no config errors. Read-only audit performed — nothing was modified.

## Raw outputs

### Caddy version + path
```
/usr/bin/caddy
v2.11.2 h1:iOlpsSiSKqEW+SIXrcZsZ/NO74SzB/ycqqvAIEfIm64=
```

### systemctl status caddy (head)
```
caddy.service - Caddy
  Loaded: loaded (/usr/lib/systemd/system/caddy.service; enabled; preset: enabled)
  Active: active (running) since Sat 2026-04-25 10:52:09 UTC; 1 day 6h ago
Main PID: 6128 (caddy)
   Tasks: 10 (limit: 4537)
  Memory: 27.4M (peak: 47.6M)
   CGroup: /system.slice/caddy.service
           └─6128 /usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
```

### curl https://openclaw.ubntag.com/healthz -I
```
HTTP/1.1 200 OK
Alt-Svc: h3=":443"; ma=2592000
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
Date: Sun, 26 Apr 2026 17:48:09 GMT
Strict-Transport-Security: max-age=31536000; includeSubDomains
Via: 1.1 Caddy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```
Body: `{"ok":true,"status":"live"}`

### curl https://openclaw.ubntag.com/ -I
```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; worker-src 'self'; connect-src 'self' ws: wss:
Content-Type: text/html; charset=utf-8
Via: 1.1 Caddy
```
(Returns the gateway's HTML UI — confirmed routing through Caddy.)

### Internal port listeners (relevant)
```
*:80                caddy (PID 6128)
*:443               caddy (PID 6128)
0.0.0.0:18789       docker-proxy (PID 415292)   <- OpenClaw gateway
0.0.0.0:18790       docker-proxy (PID 415312)   <- (additional gateway port?)
127.0.0.1:18792     node (PID 401300)            <- VAPI webhook handler
0.0.0.0:8000        docker-proxy (PID 412112)   <- michelle-fb webhook
0.0.0.0:8001        docker-proxy (PID 18550)    <- michelle-fb dashboard
*:3000              node /opt/voice (PID 7552)   <- voiceai backend
```

### Internal gateway healthz (from server itself)
```
$ curl -s http://127.0.0.1:18789/healthz
{"ok":true,"status":"live"}
```

### Let's Encrypt cert files
Path: `/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/openclaw.ubntag.com/`
```
openclaw.ubntag.com.crt
openclaw.ubntag.com.json
openclaw.ubntag.com.key
```
