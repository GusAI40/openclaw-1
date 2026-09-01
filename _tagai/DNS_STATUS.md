# DNS — System of Record (R-8)

**System of record: Vercel DNS.** Not Cloudflare. (Prior version of this doc
wrongly described Cloudflare + Coolify/Traefik — corrected 2026-05-29.)

**Validated live 2026-05-29:**

```
$ dig +short NS ubntag.com
ns1.vercel-dns.com.
ns2.vercel-dns.com.

$ dig +short SOA ubntag.com
ns1.vercel-dns.com. hostmaster.nsone.net. ...
```

The `ubntag.com` zone is authoritative on **Vercel DNS**. Manage all records in
the Vercel dashboard (project domain settings), not Cloudflare. There is no
Cloudflare account, tunnel, or API token in this stack.

## How resolution splits

| Host | Resolves to | Purpose |
|---|---|---|
| `ubntag.com` (apex) | `216.150.x.x` (Vercel anycast) | The TAG AI website (Vite SPA on Vercel) |
| `openclaw.ubntag.com` | `87.99.148.242` (Hetzner box) | Gus main Jarvis gateway |
| `julian.ubntag.com` | `87.99.148.242` | Julian tenant gateway |
| `brightsmile.ubntag.com` | `87.99.148.242` | Voice demo |

Split setup: the apex serves the website from Vercel; every Jarvis/tenant
subdomain is an A record pointing at the Hetzner box, where **Caddy on the host**
(NOT Cloudflare proxy, NOT Coolify, NOT Traefik) terminates TLS via Let's Encrypt.
Subdomains resolve directly to `87.99.148.242` (no proxy IP in front), which is
required for Caddy's Let's Encrypt HTTP-01 challenge to succeed.

## Onboarding prerequisite (do this BEFORE bootstrap-tenant.sh)

A new tenant needs its subdomain pointing at the box first:

1. In **Vercel** → the `ubntag.com` domain → add an **A record**:
   `<tenant-id>.ubntag.com  →  87.99.148.242`
2. Wait for it to resolve: `dig +short <tenant-id>.ubntag.com` returns `87.99.148.242`.
3. Then run `bootstrap-tenant.sh <id> <id>.ubntag.com <owner-email>` on the box.
   Caddy auto-issues the TLS cert on first request.

## Credential note

If you ever need to change DNS programmatically, it's the **Vercel** API/CLI
(`vercel dns`), authenticated with a Vercel token — not Cloudflare. Losing
access to the Vercel account blocks new-tenant onboarding until restored, so
keep Vercel login recoverable (1Password).
