# Business-in-a-Box Architecture Guardrails

Purpose: keep the tenant factory clean enough to sell, recover, audit, and scale.

These rules are not style preferences. They are operating constraints for every
future vertical, deploy script, intake workflow, marketing automation, and agent
handoff.

## Prime Directive

Every module has one job, owns one layer, and hides the details of the systems it
depends on. If a change requires touching three unrelated systems, the boundary is
wrong.

## Single Responsibility Map

| Unit | Owns | Must not own |
|---|---|---|
| `bootstrap/bootstrap-tenant.sh` | Base tenant provisioning: dirs, ports, token, compose, Caddy block, OpenClaw config, corp roster | Vertical business logic, marketing copy, client-specific pricing |
| `business-box/deploy/deploy-vertical.sh` | Sold-client orchestration: validate intake, call bootstrap, apply selected vertical overlay, set owner allowlist | Reimplementing Docker/Caddy provisioning, editing shared secrets, running campaigns |
| `business-box/verticals/<vertical>/` | Vertical identity, system-prompt overlay, vertical skills, required client inputs | Tenant lifecycle, DNS mutation, API key storage |
| `business-box/intake/` | Client data capture schema and validation | Deployment, secret storage, campaign execution |
| `business-box/research/` | Market research, offer research, competitor notes, provider-doc evidence | Runtime config, live sends, production mutations |
| Caddy | Public routing and TLS only | Business logic, auth decisions, tenant memory |
| OpenClaw/Jarvis tenant | Conversation state, channel routing, skill invocation | Canonical business databases, DNS, host-level secrets |
| Supabase / external systems | Durable domain data and ledgers | Tenant provisioning or prompt identity |
| Marketing campaign assets | Positioning, offers, outreach scripts, landing-page content | Infrastructure credentials or tenant config |

## Dependency Encapsulation Rules

1. A vertical depends on stable contracts, not host internals.
   - Allowed: `{{TENANT_ID}}`, `{{TENANT_NAME}}`, `{{OWNER_EMAIL}}`, `{{DOMAIN}}`, `{{VERTICAL_NAME}}`.
   - Not allowed: hardcoded `/home/tagai/.openclaw`, fixed ports, Caddy file paths, Docker container names.

2. External providers are wrapped at one boundary.
   - Vercel DNS is touched only by an onboarding/DNS step.
   - Hetzner/hcloud is touched only by dedicated-VPS provisioning.
   - Caddy is touched only by bootstrap or Caddy-specific maintenance.
   - Telegram owner identity is always numeric and validated before deploy.
   - LLM/provider model IDs are validated against current provider docs before rollout.

3. Secrets are references, not content.
   - Docs may name where secrets live.
   - Docs and scripts must not print raw API keys, tokens, cookies, or bearer values.
   - Tenant scripts may verify that a key exists, but output only presence, provider, and redacted shape.

4. Business logic is skill-level, not deploy-level.
   - `deploy-vertical.sh` may copy a construction quote skill.
   - It must not decide quote pricing, send customer emails, or write campaign logic.

5. Shared services are explicit.
   - `/home/tagai/shared-projects` is a shared capability mount.
   - Anything written there must be safe for all tenants that can read it.
   - Per-client private data belongs under that tenant's `.openclaw` or external tenant-scoped database rows.

6. Runtime mutations are idempotent or rejected.
   - Re-running deploy must not duplicate tenants, duplicate DNS blocks, or destroy memory.
   - Any destructive path must be a named teardown/archive script, never an inline side effect.

7. Fail closed.
   - Missing Telegram numeric ID: stop.
   - Unknown vertical: stop.
   - DNS not pointing at the VPS: warn for local boot, block public launch.
   - Unknown provider model ID: stop.
   - Missing pricing sheet for quotes: ask owner, never invent.

## Clean Dependency Direction

Dependencies flow one way:

```text
intake -> deploy-vertical -> bootstrap-tenant -> Docker/Caddy/OpenClaw
vertical -> deploy-vertical -> tenant workspace/config
tenant skill -> external provider adapter -> provider API
marketing campaign -> intake -> deploy-vertical
```

Forbidden reverse dependencies:

```text
bootstrap-tenant -> vertical copy
Caddy -> business rules
vertical skill -> host secret file path
campaign copy -> raw gateway token
client-facing content -> internal file paths
```

## Provider Validation Contract

Before a change touches a provider, validate the current official docs or current
source of truth for that provider.

| Provider/layer | Validate before action |
|---|---|
| OpenClaw | Current source/docs for config shape, cron delivery, upgrade behavior |
| Hetzner | Current hcloud CLI/API, server type availability, price/region facts |
| Vercel DNS | Current CLI/API command shape and auth requirements |
| Caddy | Current config syntax, automatic HTTPS behavior, port requirements |
| Telegram | Current OpenClaw Telegram target handling and Bot API behavior |
| Anthropic/OpenAI/Google/DeepSeek | Current model IDs, billing/permission requirements, deprecations |
| Supabase | Current schema, RLS, migration status, service-role blast radius |
| Resend/MS Graph/VAPI/LiveKit/Telnyx | Current auth model, rate limits, webhook shape, retry semantics |

If docs are unavailable, mark the claim as unverified and do not run a mutating
command on production.

## Paid-Tenant Launch Gates

Do not sell a tenant as production-ready until these pass:

1. Public access is only through Caddy on 80/443.
2. Tenant gateway/bridge ports are loopback-bound.
3. Telegram/channel allowlist is explicit and numeric.
4. Device pairing requires a second-channel approval, not auto-approve cron.
5. Backups have a tested restore path and the age key has an off-box copy.
6. `openclaw.json.meta.lastTouchedVersion` matches the running image version.
7. Model fallback chain uses valid current provider model IDs.
8. One dry-run deploy and one real smoke test pass for the selected vertical.
9. Client-facing campaign assets contain no internal tokens, file paths, or private customer data.

## Vertical Checklist

Every new vertical must include:

1. `vertical.env` with non-secret metadata.
2. `system-prompt.overlay.md` with domain behavior and hard gates.
3. At least three skills:
   - intake/capture
   - value-producing action
   - follow-up/reporting
4. A required-input list for onboarding.
5. A smoke-test script or manual test prompt.
6. A marketing offer:
   - one-line promise
   - target buyer
   - pain addressed
   - proof artifact
   - pilot price

## Engineering Bar

Advanced engineering here means restraint:

- Do not add a service when a file contract works.
- Do not add a framework when a shell contract is enough.
- Do not hide production changes inside "helper" scripts.
- Do not let client copy depend on internal implementation details.
- Do not mix discovery, deployment, and mutation in one command.
- Do not trust prior docs when live state or current provider docs disagree.

The highest-value code is the boring code that can be rerun, audited, and
explained under pressure.
