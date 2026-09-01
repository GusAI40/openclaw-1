# Bootstrap secrets — what's in git vs what's not (R-6)

This directory holds the **tenant bootstrap tooling**, promoted into the repo on
2026-05-29 so a fresh-box recovery is `git clone` + a backup restore (R-6).

## In git (safe)
- `bootstrap-tenant.sh`, `teardown-tenant.sh`, `list-tenants.sh` — the tooling.
  `bootstrap-tenant.sh` generates the gateway token at runtime (`openssl rand`)
  and reads provider keys from the shared env — it hardcodes no secrets.
- `README.md`, `HERMES-SWARM-EXTRACTION.md` — docs.
- `_template/*.tpl` — Caddyfile / docker-compose / openclaw.json templates.
  `openclaw.json.tpl` identity values (MS tenant/client id, default user) were
  replaced with `{{PLACEHOLDER}}` before commit.
- `_template/corp/*.csv`, `_template/hermes-army/*.md` — the agent org-chart
  templates (fictional agent roles, no third-party PII).
- `*.example` files — sanitized structure of the secret-bearing files.

## NOT in git (real secrets — git-ignored, restore from encrypted backup)
- `_template/.env.tpl` — live provider keys + tokens. Example: `.env.tpl.example`.
- `_template/agents-main-agent/auth-profiles.json` — live LLM API keys (mode 600).
  Example: `auth-profiles.json.example`. Without it the runtime fails over
  `deepseek -> gemini` forever.
- `_template/agents-main-agent/auth-state.json` — OAuth/session state.
- any `.gateway-token`.

## Fresh-box recovery
1. `git clone` this repo → you get all the tooling above.
2. Restore the git-ignored secret files from the nightly age-encrypted backup
   (repo `GusAI40/tagai-cloud-backups`; key in 1Password — see R-4).
3. Run `bootstrap-tenant.sh <id> <subdomain.ubntag.com> <owner-email>`.
   Prereq: add the A record `<id>.ubntag.com -> 87.99.148.242` on Vercel DNS first.
