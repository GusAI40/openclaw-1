# Security 10x Re-Engineering Map - July 3, 2026

## Executive Summary

This is the "city rebuild" plan for securing the TAG Jarvis AI/OpenClaw environment.

Plain English: the repo is a city. The gateway is city hall. Agents are workers. Provider tokens are master keys. Supabase is the bank. GitHub is the blueprint office. Vercel and Hetzner are delivery roads. Caddy is the front gate. If a master key has appeared in a chat transcript, it must be treated as copied.

I cannot obtain or claim direct Elon Musk sign-off. The practical replacement is a first-principles sign-off gate: remove every known weak point, verify with tools, document proof, and only then call the environment ready.

## Current Evidence

Local checks run from the repo root:

| Check | Result | What it means |
| --- | --- | --- |
| `pnpm docs:list` | Passed | Repo docs index exists and points to security, secrets, sandbox, gateway, and web exposure docs. |
| Redacted token scan | 13 high-risk token-shaped hits | Hits are test fixtures and e2e fake tokens after masked review. No Vercel PAT or Supabase PAT pattern was found in the scanned working tree. |
| Tracked-file token filename scan | Found old audit notes, `_tagai/ECOSYSTEM.md`, tests, and redaction code | `_tagai/ECOSYSTEM.md` records that live GitHub and Supabase tokens passed through chat transcripts. It appears redacted, but the operational risk is real. |
| GitHub secret scanning API for `GusAI40/openclaw-1` | Returned `[]` | No open secret scanning alerts returned by the API for the fork at scan time. This does not prove chat-exposed tokens are safe. |
| `pnpm check:no-conflict-markers` | Passed | No merge conflict markers found. |
| `python -m detect_secrets scan ...` | Timed out twice | The repo has a baseline, but the local scan path needs narrowing or CI execution. Do not mark secrets clean from this tool yet. |
| `pnpm openclaw security audit --json` | Timed out | Built-in security audit did not complete locally in the time window. This remains open. |
| `pnpm openclaw secrets audit --check --json` | Timed out | Built-in secrets audit did not complete locally in the time window. This remains open. |
| `pnpm audit --prod --json` | Failed | 81 moderate-or-higher production dependency advisories: 36 high, 45 moderate, 0 critical. |

Processes left by timed-out audit commands were stopped after verification.

## Official Documentation Checked

These current official docs were checked before this plan:

| Provider or platform | Official doc checked | Repo dependency |
| --- | --- | --- |
| GitHub PATs | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens | Personal access tokens, Git remotes, API automation, PR and CI workflow access. |
| GitHub API credential security | https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure | Minimum scopes, token expiration, fine-grained PAT preference. |
| GitHub secret scanning | https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning | Secret scanning alerts, repository history scanning, and leak remediation. |
| GitHub Actions token guidance | https://docs.github.com/actions/reference/authentication-in-a-workflow | Prefer `GITHUB_TOKEN` or GitHub App installation tokens over broad PATs in workflows. |
| Vercel environment variables | https://vercel.com/docs/environment-variables | Vercel project and deployment configuration. |
| Vercel sensitive env vars | https://vercel.com/docs/environment-variables/sensitive-environment-variables | Tokens should be non-readable after creation where Vercel supports it. |
| Vercel secret rotation | https://vercel.com/docs/environment-variables/rotating-secrets | Rotated environment variables need redeploys to reach live deployments. |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | Database row access policies for tenant and customer data. |
| Supabase API security | https://supabase.com/docs/guides/api/securing-your-api | Grants plus RLS determine which roles can touch data. |
| Supabase storage access | https://supabase.com/docs/guides/storage/security/access-control | Storage must use access policies, not just bucket naming. |
| Docker build secrets | https://docs.docker.com/build/building/secrets/ | Build-time secrets must use secret mounts, not Dockerfile `ARG` or `ENV`. |
| Docker Dockerfile secret warning | https://docs.docker.com/reference/build-checks/secrets-used-in-arg-or-env/ | Secrets in `ARG` or `ENV` persist into images and are unsafe. |
| Docker rootless mode | https://docs.docker.com/engine/security/rootless/ | Container runtime hardening option for reducing host-level damage. |
| Docker user namespaces | https://docs.docker.com/engine/security/userns-remap/ | Map container root to an unprivileged host user where possible. |
| Docker Compose secrets | https://docs.docker.com/compose/how-tos/use-secrets/ | Prefer secrets files or mounted secrets over raw env files when practical. |
| Caddy automatic HTTPS | https://caddyserver.com/docs/caddyfile/options | TLS automation and HTTPS redirect controls. |
| Caddy reverse proxy | https://caddyserver.com/docs/caddyfile/directives/reverse_proxy | Front gate to the local OpenClaw gateway. |
| Caddy trusted proxies | https://caddyserver.com/docs/json/apps/http/servers/trusted_proxies/ | Real client IP trust must be explicit. |
| Tailscale ingress and Serve model | https://tailscale.com/kb/1439/kubernetes-operator-cluster-ingress | Tailnet exposure is different from public internet exposure. |
| OpenClaw security docs | `SECURITY.md`, `docs/gateway/security/index.md`, `docs/cli/security.md` | Gateway trust model, audit command, public exposure warnings. |
| OpenClaw secrets docs | `docs/gateway/secrets.md`, `docs/cli/secrets.md` | SecretRef model, runtime snapshot, plaintext audit path. |
| OpenClaw sandbox docs | `docs/gateway/sandboxing.md`, `docs/tools/multi-agent-sandbox-tools.md` | Agent isolation, tool restrictions, and sandbox modes. |
| OpenClaw web docs | `docs/web/index.md` | Control UI, bind modes, CORS origin expectations, Tailscale Serve guidance. |

The YouTube URL was opened, but no transcript was available in the fetched page output. I treated it as a system-design prompt, not as a source of quoted technical facts.

## State, City, Streets, Houses, Rooms, Workers

### State: TAG AI Business Operating System

This is the parent ecosystem. It includes Jarvis AI, the OpenClaw gateway fork, Supabase, provider accounts, GitHub, Vercel, Hetzner, Caddy, channels, skills, and revenue workflows.

Revenue purpose: turn AI work into actual business execution: lead capture, outreach, client service, content, automations, and internal leverage.

### City: Jarvis AI / OpenClaw Repo

The repo is the working city. It is not just a website. It is a gateway that lets agents talk to tools, channels, providers, files, browsers, and APIs.

Revenue purpose: one control center that can automate work across the business without rebuilding a separate bot for every channel.

### Street 1: Identity And Access

Houses:

- GitHub accounts and tokens
- Vercel account and tokens
- Supabase account and tokens
- OpenClaw gateway token/password
- Server SSH access

Rooms:

- Git remotes
- GitHub CLI auth
- GitHub repo secrets
- Vercel project env vars
- Supabase project keys
- `~/.openclaw` credentials on the server

Workers:

- GitHub Actions
- GitHub CLI
- OpenClaw gateway
- Deployment scripts

Revenue purpose: lets the system ship, deploy, read/write business data, and automate operations.

Failure mode: if one master key leaks, an attacker may copy code, change deployments, steal data, or break automations.

### Street 2: Secrets Vault

Houses:

- `_tagai/.env.tagai.example`
- server `.env` files
- OpenClaw SecretRefs
- Vercel sensitive env vars
- Supabase dashboard secrets

Rooms:

- API keys
- PATs
- webhook tokens
- model keys
- channel bot tokens

Workers:

- `openclaw secrets audit`
- `detect-secrets`
- GitHub secret scanning
- Vercel env management

Revenue purpose: safe keys let automations run without giving every worker a master key.

Failure mode: plaintext tokens in chats, files, Docker images, logs, or Git history become stolen keys.

### Street 3: Data Bank

Houses:

- Supabase Postgres
- Supabase Storage
- JARVIS business data
- tenant/customer tables

Rooms:

- RLS policies
- grants
- service role key
- anon and authenticated roles
- storage policies

Workers:

- Supabase clients
- backend services
- AI workflows that read/write business data

Revenue purpose: stores leads, customers, tasks, campaign data, and operational memory.

Failure mode: missing RLS or overbroad service-role usage can expose all customer data.

### Street 4: Gateway And Front Gate

Houses:

- OpenClaw gateway
- Control UI
- Caddy reverse proxy
- Tailscale or public DNS path
- webhooks

Rooms:

- `gateway.bind`
- `gateway.auth`
- `gateway.controlUi.allowedOrigins`
- Caddy routes
- webhook path and token settings

Workers:

- Gateway HTTP/WebSocket server
- Caddy
- webhook handlers

Revenue purpose: makes the assistant reachable by operators and workflows.

Failure mode: public gateway exposure with weak auth turns the city hall door into an unlocked front entrance.

### Street 5: Agent Workforce

Houses:

- main agent
- business agents
- channel agents
- subagents
- skills

Rooms:

- tool allowlists
- tool denylists
- sandbox mode
- workspace roots
- auth profiles
- prompts and skill instructions

Workers:

- OpenClaw agents
- subagents
- skills installed under `.agents` or Codex skills

Revenue purpose: actual labor replacement: research, drafting, outreach, support, analysis, and delivery.

Failure mode: prompt injection plus broad tools can cause file access, shell execution, browser misuse, or bad customer-facing actions.

### Street 6: Deployment Road

Houses:

- Hetzner server
- Docker Compose
- Caddy host proxy
- Vercel DNS or project env

Rooms:

- Docker Compose overlay
- image build context
- volumes
- server `.env`
- service restart scripts

Workers:

- Docker daemon
- Caddy service
- deployment shell scripts

Revenue purpose: keeps the gateway running for customers and internal operators.

Failure mode: secrets in Docker build args, root containers, exposed Docker socket, or stale images increase blast radius.

### Street 7: GitHub Factory

Houses:

- repository
- pull requests
- CodeQL
- Dependabot
- secret scanning
- CI

Rooms:

- `.github/dependabot.yml`
- `.github/workflows/codeql.yml`
- branch protections
- repo secrets
- labels and PR review rules

Workers:

- GitHub Actions
- Dependabot
- CodeQL
- maintainers

Revenue purpose: keeps the system shippable and reduces incident cost.

Failure mode: high dependency advisories or broad workflow tokens let attackers exploit the factory.

### Street 8: Supply Chain

Houses:

- pnpm lockfile
- npm packages
- Docker base images
- plugins
- skills

Rooms:

- `pnpm-lock.yaml`
- `package.json`
- plugin manifests
- skill install records
- dependency overrides

Workers:

- pnpm
- Dependabot
- repo audit scripts
- plugin loaders

Revenue purpose: speeds up development by using proven parts.

Failure mode: one vulnerable part can poison the city water supply.

### Street 9: Logs And Cameras

Houses:

- diagnostic logs
- redaction utilities
- telemetry extensions
- health reports

Rooms:

- log redaction rules
- token masking tests
- monitoring snapshots
- GitHub artifacts

Workers:

- loggers
- audit commands
- CI artifacts

Revenue purpose: tells operators what broke before customers feel it.

Failure mode: logs can become a second secret leak if redaction is weak.

### Street 10: Incident Response

Houses:

- rotation runbooks
- backup scripts
- restore tests
- risk register

Rooms:

- provider dashboards
- backup repo
- restore commands
- communication templates

Workers:

- operator
- GitHub security tooling
- Supabase/Vercel/GitHub admin dashboards

Revenue purpose: reduces downtime and trust damage after a leak or outage.

Failure mode: a plan that exists only in memory fails under pressure.

### Street 11: Revenue Execution

Houses:

- lead gen workflows
- content workflows
- customer support workflows
- rescue website audits
- outreach and follow-up

Rooms:

- prompts
- channel strategies
- Supabase tables
- skills
- campaign docs

Workers:

- AI agents
- messaging channels
- automation scripts
- humans approving external sends

Revenue purpose: generate leads, close work, save operator time, and improve customer response speed.

Failure mode: insecure automation creates business liability faster than it creates revenue.

## 11-Pillar Rebuild Plan

### 1. Burn And Rotate Exposed Tokens

Rule: every token pasted into a chat is treated as burned.

Immediate action:

- Revoke the pasted GitHub PAT.
- Revoke the pasted Vercel PAT.
- Revoke the pasted Supabase PAT.
- Replace each with least-privilege, expiring credentials.
- Record the rotation date and owner, not the token value.

Revenue impact: prevents one leaked key from shutting down deploys or exposing customer data.

### 2. Replace Broad PATs With Short-Lived Or Scoped Access

GitHub official guidance favors minimum permissions, expiration, fine-grained PATs, GitHub Apps, and built-in `GITHUB_TOKEN` where possible.

Immediate action:

- Use `GITHUB_TOKEN` inside Actions whenever possible.
- Use GitHub App installation tokens for automation that needs more than `GITHUB_TOKEN`.
- Use fine-grained PATs only when no better path exists.

Revenue impact: automations keep working while stolen tokens become less useful.

### 3. Make Vercel Secrets Non-Readable And Redeploy After Rotation

Vercel supports sensitive environment variables that are non-readable after creation. Vercel docs also state changed environment variables require a new deployment to affect old deployments.

Immediate action:

- Move production and preview secrets to sensitive env vars.
- Rotate secrets.
- Redeploy affected projects.
- Remove any local `.env` pulled from Vercel if not needed.

Revenue impact: keeps deployment speed without turning the dashboard into a vault leak.

### 4. Lock Supabase With Grants Plus RLS

Supabase docs are clear: grants decide which roles can touch objects, RLS decides which rows they can see.

Immediate action:

- Confirm RLS is enabled on every exposed business table.
- Confirm storage bucket policies match tenant boundaries.
- Keep `service_role` server-only.
- Split tenants or projects if Gus and Julian data cannot share the same risk boundary.

Revenue impact: customer data can power automation without becoming all-or-nothing access.

### 5. Keep Gateway Local Or Behind Identity-Aware Access

OpenClaw docs define a one-operator gateway trust model. It is not a hostile multi-user SaaS boundary.

Immediate action:

- Prefer loopback gateway bind.
- Put Caddy or Tailscale in front only with strong auth.
- For non-loopback Control UI, set explicit allowed origins.
- Do not expose `/tools/invoke` or `/v1/*` publicly with weak shared secrets.

Revenue impact: operators can use the assistant without handing the internet a control panel.

### 6. Sandbox Agents By Default

OpenClaw sandboxing reduces blast radius when models make bad tool choices.

Immediate action:

- Set shared or public-channel agents to `sandbox.mode="all"`.
- Deny `exec`, `write`, `edit`, `apply_patch`, browser, and runtime tools to agents that only need messaging.
- Keep personal and company agents in separate OS users, hosts, or gateways if trust differs.

Revenue impact: lets automation scale without every agent holding the keys to the whole city.

### 7. Pin Plugins And Skills To Trusted Inventory

OpenClaw treats plugins as trusted code running inside the gateway.

Immediate action:

- Use explicit plugin allowlists.
- Remove unused plugins and skills.
- Pin install sources and versions where possible.
- Run plugin security scans before enabling new tool surfaces.

Revenue impact: new capabilities can be added without letting unknown code into the control room.

### 8. Harden Webhooks

Webhooks are delivery doors. They must be narrow.

Immediate action:

- Do not use `/` as a webhook path.
- Use long unique webhook tokens.
- Do not reuse the gateway token as the webhook token.
- Restrict allowed agents and session key prefixes.
- Verify any deleted or replaced webhook handler before deploy.

Revenue impact: keeps automations connected to outside systems without accepting random internet pushes.

### 9. Harden Docker And Server Runtime

Docker docs warn that secrets in Dockerfile `ARG` or `ENV` persist in images. Docker rootless and user namespace docs reduce host blast radius.

Immediate action:

- Do not pass production secrets as Docker build args.
- Use runtime env files or Compose secrets for runtime secrets.
- Evaluate Docker rootless mode or user namespace remap on Hetzner.
- Avoid mounting the Docker socket into untrusted containers.
- Use read-only mounts where practical.

Revenue impact: production stays easy to restart without making container escape catastrophic.

### 10. Fix Supply Chain Advisories

`pnpm audit --prod --json` found 81 moderate-or-higher advisories, including 36 high.

Immediate action:

- Open a dependency-hardening PR or issue.
- Let Dependabot propose safe patch/minor updates.
- Prioritize network-facing packages: `axios`, `undici`, `@grpc/grpc-js`, `hono`, `protobufjs`, `dompurify`, `linkify-it`.
- Run repo gates before merging.

Constraint: repo rules say dependency patches, overrides, and vendor changes need explicit approval.

Revenue impact: reduces avoidable outages and exploit risk in customer-facing systems.

### 11. Install A Real Sign-Off Gate

Replace informal confidence with proof.

Sign-off requirements:

- All chat-exposed provider tokens revoked.
- Replacement credentials are least-privilege and expiring.
- GitHub secret scanning alerts are zero or triaged.
- Local redacted scan has no live PAT patterns outside tests/docs.
- `openclaw security audit --json` completes.
- `openclaw secrets audit --check --json` completes or has documented accepted findings.
- `pnpm audit --prod` is clean or every remaining advisory is risk-accepted with owner and reason.
- Supabase RLS and grants are reviewed table by table.
- Gateway bind/auth/Caddy/Tailscale exposure is reviewed against production config.
- Backup restore is tested.
- External sends remain human-approved unless a workflow has explicit approval policy.

Revenue impact: the company can move faster because the stop/go line is clear.

## Risk Register

| Severity | Risk | Evidence | Owner action |
| --- | --- | --- | --- |
| Critical | Chat-exposed provider tokens | User-provided GitHub, Vercel, and Supabase PATs in this thread; `_tagai/ECOSYSTEM.md` also records previous live token transcript exposure. | Revoke and replace now. |
| High | Production dependency advisories | `pnpm audit --prod --json`: 36 high, 45 moderate. | Create dependency-hardening PR after explicit approval. |
| High | Built-in security audits timed out locally | `pnpm openclaw security audit --json` and `pnpm openclaw secrets audit --check --json` did not complete within 120 seconds. | Debug audit runtime or run in CI/clean host. |
| High | Original worktree is dirty | Firecrawl files changed, webhook handler deleted, TAG overlay changed. | Review before deploy or merge. |
| High | OpenClaw is not multi-tenant by design | `SECURITY.md` and docs say one gateway is not a hostile multi-user boundary. | Separate trust boundaries by host/OS user/gateway/account. |
| Medium | Secret scan baseline did not complete locally | `detect-secrets` installed, but scan timed out. | Narrow scan paths or run in CI with timeout budget. |
| Medium | Clean PR worktree has unrelated `CLAUDE.md` edit | Local diff exists and was not staged. | Owner should decide whether to keep or revert separately. |
| Medium | Provider rotation can break tenants | `_tagai/ECOSYSTEM.md` notes shared Supabase token across Gus and Julian configs. | Rotate in a coordinated maintenance window. |

## Action Plan

### Next 0-2 Hours

1. Revoke the pasted GitHub, Vercel, and Supabase PATs.
2. Create replacement credentials with the smallest needed scopes and expiration.
3. Update server-side secret stores only. Do not paste values into chat.
4. Redeploy any Vercel project that depends on rotated env vars.
5. Confirm GitHub secret scanning alerts remain empty after rotation.

### Next 24 Hours

1. Run `openclaw security audit --deep --json` on the actual Hetzner runtime.
2. Run `openclaw secrets audit --check --json` on the actual Hetzner runtime.
3. Review Supabase RLS and grants for every exposed table and storage bucket.
4. Review Caddy config and gateway bind/auth settings against production.
5. Review the deleted `_tagai/webhook-handler.mjs` and Firecrawl changes before any deploy.

### Next 3-7 Days

1. Open dependency-hardening work for the 81 production advisories.
2. Add a fast redacted secret scan lane to CI.
3. Add a monthly token rotation calendar.
4. Test backup restore, not just backup creation.
5. Split Gus and Julian credentials if they do not share the same trust boundary.

## Ready-To-Commit README Snippet

```md
## Security 10x Hardening

Latest security rebuild map:

- `_tagai/security-10x-2026-07-03/SECURITY_REENGINEERING_MAP.md`

Use this before deploying, rotating credentials, changing gateway exposure, or enabling new agents/plugins. It maps the repo as a city, lists the 11 hardening pillars, records official documentation checked, and defines the sign-off gates required before calling the environment secure.
```

## Sign-Off

Current status: not signed off.

Reason: provider tokens that appeared in chat must be rotated, production dependency advisories remain open, and local OpenClaw security/secrets audits timed out. The repo is not "no holes" until those gates are closed with evidence.
