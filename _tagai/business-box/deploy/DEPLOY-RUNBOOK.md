# Deploy Runbook — Business-in-a-Box (Construction vertical)

The "5-button" path from a **sold client** to a **live Jarvis tenant**.

This runbook does NOT replace the proven provisioner. `deploy-vertical.sh` is a
thin wrapper that **calls `_tagai/bootstrap/bootstrap-tenant.sh`** (the real
engine) and then paints the construction vertical on top. If you understand
`bootstrap-tenant.sh`, you understand 90% of this.

---

## What's automated vs. what's a human step (be honest)

| Step | Automated? | By what |
|---|---|---|
| Generate gateway token, allocate ports | YES | bootstrap-tenant.sh |
| Render compose / openclaw.json (schema-clobber guard) | YES | bootstrap-tenant.sh |
| Seed corp roster + hermes-army skills | YES | bootstrap-tenant.sh |
| Install Caddy site block, start container, healthcheck | YES | bootstrap-tenant.sh |
| Overlay construction system prompt + skills | YES | deploy-vertical.sh (step 2) |
| Set owner Telegram allowlist (numeric id) | YES | deploy-vertical.sh (step 3) |
| **Vercel DNS A-record** `<id>.ubntag.com -> 87.99.148.242` | **NO — MANUAL** | you, in the Vercel dashboard, BEFORE deploy |
| **Owner finds their numeric Telegram id** | **NO — MANUAL** | owner messages `@userinfobot` |
| **Drop the owner's pricing sheet** | **NO — MANUAL** | you copy `pricing-construction.csv` after deploy |
| **Dedicated VPS** (`--new-vps`) | **PARTIAL** | hcloud creates the box; OS/host-prep is still manual |

The default and proven model is **many tenants on the one CPX21**
(`87.99.148.242`). Gus, Julian, and the brightsmile demo already colocate there.
You only need `--new-vps` when a client contractually requires isolation.

---

## The 5 buttons

### Button 1 — Add the Vercel DNS record (MANUAL, do this first)
`ubntag.com` DNS lives on **Vercel**, not Cloudflare. Add:

```
A   <client-id>.ubntag.com   87.99.148.242
```

Wait for it to resolve before you deploy, or Caddy's Let's Encrypt cert will
fail:
```bash
dig +short <client-id>.ubntag.com   # must return 87.99.148.242
```

### Button 2 — Get the owner's NUMERIC Telegram id (MANUAL)
The owner opens Telegram, messages **@userinfobot**, and sends you the `Id:`
number (e.g. `123456789`). A `@username` will NOT work — the allowlist matches
the numeric id only. This is the single most common onboarding footgun.

### Button 3 — SSH to the shared box
```bash
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242
```
(Use Git Bash / the Bash tool on Windows — PowerShell `scp`/`ssh` can't read
`~/.ssh/config` on Gus's machine.)

The `_tagai/` tree must be present on the box (it is, on the shared host). If
deploying to a brand-new dedicated box, copy `_tagai/bootstrap` + the secret
files first (see "Dedicated VPS" below).

### Button 4 — Run the deploy engine
```bash
cd /home/tagai/openclaw/_tagai/business-box/deploy   # path to this repo on the box

./deploy-vertical.sh \
  --vertical construction \
  --client-id acme-builders \
  --subdomain acme-builders.ubntag.com \
  --owner-email owner@acme.com \
  --owner-telegram 123456789
```

Tip: add `--dry-run` first to see the plan and catch a DNS/typo mistake before
anything is created. Re-running the same command is **idempotent**.

What it does, in order:
1. **STEP 1** — calls `bootstrap-tenant.sh acme-builders acme-builders.ubntag.com owner@acme.com`
   (the full provision: token, ports, compose, config, Caddy, container, health).
2. **STEP 2** — writes the construction system-prompt overlay + the three
   construction skills (`intake`, `quote`, `followup`) into the tenant, plus a
   `vertical.json` marker.
3. **STEP 3** — patches `openclaw.json` so `channels.telegram.allowFrom` =
   `[123456789]` and restarts the container with `docker compose up -d`.

### Button 5 — Run the post-deploy checklist (printed by the script)
- [ ] `curl -sf https://acme-builders.ubntag.com/ && echo OK`
- [ ] Owner sends a Telegram message **from the allowlisted numeric id** — bot replies.
- [ ] Copy the owner's price sheet to
      `/home/tagai/tenants/acme-builders/.openclaw/corp/pricing-construction.csv`
      (the quote skill refuses to invent prices without it).
- [ ] Smoke test: message "I need a quote for a kitchen remodel" → intake skill fires.
- [ ] Save the gateway token (printed by bootstrap) into 1Password.

---

## Dedicated VPS (only when a client needs isolation)

```bash
./deploy-vertical.sh --new-vps --vps-type cpx21 --vps-location nbg1 \
  --vertical construction --client-id bigco \
  --subdomain bigco.ubntag.com --owner-email it@bigco.com --owner-telegram 555
```

Honest caveats:
- If `hcloud` is **not installed or not authenticated**, the script prints the
  exact `hcloud context create` + `hcloud server create` commands and exits. It
  does **not** silently pretend to create a box.
- Creating the server is NOT the same as a ready host. A fresh Ubuntu box still
  needs: Docker, Caddy + the `/etc/caddy/Caddyfile.d/*.conf` import line, the
  `_tagai/bootstrap` tooling, and the shared-secret files
  (`.openclaw-shared.env`, the auth-profiles template). Do the one-time host
  prep from `_tagai/bootstrap/README.md`, point Vercel DNS at the NEW ip, then
  re-run this script on that box **without** `--new-vps`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| HTTPS 502 / cert fails | DNS A-record missing or not propagated | Add Vercel record, `dig +short`, retry |
| Bot ignores the owner | wrong / `@handle` instead of numeric id | re-run with correct `--owner-telegram` (idempotent) |
| Quote skill says "I don't have a price" | no pricing sheet | drop `pricing-construction.csv` in the tenant `corp/` dir |
| Config wiped on restart | schema-clobber (version mismatch) | bootstrap already pins `meta.lastTouchedVersion` to the image version (2026.4.25); don't hand-edit it |
| Port collision error | two client-ids hashed to one slot | pick a slightly different `--client-id` |

## Files

| Path | Role |
|---|---|
| `deploy-vertical.sh` | the wrapper (this engine) |
| `../verticals/construction/system-prompt.overlay.md` | construction identity overlay |
| `../verticals/construction/skills/*.md` | intake / quote / followup skills |
| `../verticals/construction/vertical.env` | vertical metadata (name, tagline) |
| `../../bootstrap/bootstrap-tenant.sh` | **the real provisioner — reused, not duplicated** |
| `../../bootstrap/teardown-tenant.sh` | reverse of bootstrap (archives, never deletes) |
