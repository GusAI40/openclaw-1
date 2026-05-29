# Business-in-a-Box

This folder turns a sold client into an isolated Jarvis/OpenClaw tenant with a
vertical-specific operating layer.

Read [ARCHITECTURE_GUARDRAILS.md](./ARCHITECTURE_GUARDRAILS.md) before changing
deploy, intake, verticals, research, or campaign assets. The core rule is simple:
one module, one responsibility, explicit dependencies, no hidden production
mutation.

## Folder Responsibilities

| Folder | Responsibility |
|---|---|
| `deploy/` | Orchestrates sold-client deployment by calling the tenant factory and applying the selected vertical. |
| `intake/` | Captures and validates client data before deploy. |
| `research/` | Stores market/provider/offer research used to design verticals and campaigns. |
| `verticals/` | Holds business-domain overlays: prompts, skills, metadata, and smoke tests. |

## Current Vertical

| Vertical | Status | Notes |
|---|---|---|
| `construction` | scaffolded | Includes lead intake, estimate draft, and follow-up sweep. |

## Non-Negotiables

- `deploy-vertical.sh` must call `bootstrap-tenant.sh`; it must not duplicate tenant provisioning.
- A vertical must not know Caddy paths, Docker internals, fixed ports, or secret file paths.
- Any provider fact used in a deploy or campaign must be validated against current official docs/source before production action.
- Paid tenants require loopback-bound ports, explicit channel allowlists, safe device pairing, and a tested backup restore path.
