# DNS Status — Already Configured

**Status:** `ALREADY_EXISTS`
**Verified:** 2026-04-26

## Current resolution (verified via Cloudflare 1.1.1.1)

```
$ nslookup openclaw.ubntag.com 1.1.1.1
Name:    openclaw.ubntag.com
Address: 87.99.148.242
```

The A record for `openclaw.ubntag.com` -> `87.99.148.242` (Hetzner CPX21 `tagai-cloud`) is already live and resolving correctly. No action needed.

## Apex comparison (for context)

```
$ nslookup ubntag.com 1.1.1.1
Name:    ubntag.com
Addresses: 216.150.1.193, 216.150.16.1   (Vercel — main TAG AI website)
```

The apex points to Vercel, the `openclaw` subdomain points to Hetzner. Split-domain setup is intact.

## Credentials audit (for future reference)

Searched the following locations for Cloudflare API access:

| Location | Result |
|---|---|
| `~/.env` | No `CLOUDFLARE_*` / `CF_*` keys present |
| `~/.cloudflared/` | Directory does not exist |
| `~/.cloudflare-warp/` | Directory does not exist |
| `cloudflared` CLI | Installed at `C:\Program Files (x86)\cloudflared\` but NOT authenticated (no `cert.pem`) |
| `flarectl` | Not installed |

If future DNS changes are needed via API, you'll need to either:
1. Run `cloudflared tunnel login` to generate a `cert.pem` (browser-based auth), OR
2. Generate a scoped API token at https://dash.cloudflare.com/profile/api-tokens with `Zone:DNS:Edit` permission for `ubntag.com`, then add `CLOUDFLARE_API_TOKEN=...` to `~/.env`.

## Why proxy is OFF on this record

Coolify + Traefik on the Hetzner box handle Let's Encrypt SSL termination directly. Cloudflare proxy in front would interfere with the Let's Encrypt HTTP-01 challenge unless Origin Certificates are configured (more complex, not needed for Tier 1 launch).

The fact that `openclaw.ubntag.com` resolves directly to `87.99.148.242` (not a Cloudflare proxy IP like `104.x.x.x` or `172.x.x.x`) confirms the gray-cloud (DNS-only) configuration is already in place.
