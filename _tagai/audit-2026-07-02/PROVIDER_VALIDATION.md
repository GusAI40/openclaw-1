# Provider Validation Report - 2026-07-02

Context7 MCP was not available in this session, so official web documentation was used directly. This file lists the docs checked and what repo areas depend on each provider or framework.

## Validation Table

| Provider or framework | Official docs checked | Repo dependency | Current finding | Action needed |
| --- | --- | --- | --- | --- |
| Vercel CLI | https://vercel.com/docs/cli | Vercel operations and future CI playbooks | Local CLI is `54.18.1`. Docs recommend `VERCEL_TOKEN` env in CI instead of exposing token flags. | Use env-based auth. Do not hardcode tokens. |
| Vercel `vercel.ts` | https://vercel.com/docs/project-configuration/vercel-ts | Adjacent Vercel web app repos | This repo has no Vercel app config, so adding `vercel.ts` here would be cosmetic. | Add `vercel.ts` only inside actual Vercel app repos. |
| Vercel Fluid Compute | https://vercel.com/docs/fluid-compute | AI/API-heavy web apps | Strong fit for report generation, model calls, and API routes in Vercel-hosted apps. | Adopt in adjacent TAG site repos after project-level validation. |
| Vercel AI Gateway | https://vercel.com/docs/ai-gateway | `extensions/vercel-ai-gateway/`, model routing, adjacent apps | Fit for multi-model control, observability, and fallback. | Validate model IDs live before changing defaults. |
| Vercel Workflows | https://vercel.com/docs/workflows | Lead pipeline orchestration | Good match for scan -> report -> outreach -> follow-up. | Prototype in a Vercel-hosted rescue app, not this gateway repo first. |
| Vercel Queues | https://vercel.com/docs/queues | Background scan/email jobs | Good match for durable job queues and retries. | Use for outbound/report jobs after sender-domain safety is fixed. |
| Vercel Sandbox | https://vercel.com/docs/sandbox | Agent code execution experiments | Candidate for hosted agent workbenches. | Do parity proof before replacing local/Docker sandbox. |
| Vercel Rolling Releases | https://vercel.com/docs/rolling-releases | Customer-facing Vercel apps | Useful for safer rollout of revenue pages. | Add to production Vercel app release playbook. |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | rescue data, tenant data, MCP | RLS must be enabled on exposed tables; policies must match actual ownership. | Continue advisors and tenant-isolation design. |
| Supabase Data API grants | https://supabase.com/changelog and https://supabase.com/docs/guides/api/securing-your-api | SQL migrations and client access | Supabase is moving toward explicit grants for Data API access. RLS is not the same as grants. | Migrations should include grants plus RLS plus policies. |
| Supabase MCP | https://supabase.com/docs/guides/ai-tools/mcp | `_tagai/bootstrap/_template/openclaw.json.tpl` | MCP exists for project/database operations. | Keep PATs out of repo; use scoped auth. |
| GitHub PATs | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens | Git push, GitHub CLI, CI | PATs pasted in chat are exposed secrets. | Rotate them after this work window. |
| pnpm settings | https://pnpm.io/settings | monorepo install, docs scripts, tests | Follow-up work moved pnpm settings into `pnpm-workspace.yaml`; `blockExoticSubdeps` stays enabled. | Keep settings in `pnpm-workspace.yaml` and verify future pnpm changes against official docs. |
| WhiskeySockets Baileys | https://github.com/WhiskeySockets/Baileys/releases and package metadata | `extensions/whatsapp/` WhatsApp plugin | `7.0.0-rc13` is the current package used locally; its `libsignal` dependency resolves from npm, not GitHub codeload. | Keep WhatsApp tests in the dependency-upgrade gate. |
| Node.js ESM | https://nodejs.org/api/esm.html | package `"type": "module"`, TS ESM code | Repo is ESM and targets Node 22+. | Keep explicit extensions and ESM-safe imports. |
| TypeScript | https://www.typescriptlang.org/docs/ | strict TS build lanes | Repo uses TypeScript and tsgo lanes. | Use repo typecheck commands, not ad-hoc `tsc --noEmit`. |
| Vitest | https://vitest.dev/guide/ | test lanes | Repo uses Vitest through scripts. | Run repo scripts, not raw `vitest`. |
| tsdown | https://tsdown.dev/ | build tooling | Repo uses `tsdown`. | Build changes should run `pnpm build` when module boundaries change. |
| OpenAI API and Node SDK | https://platform.openai.com/docs/api-reference and https://github.com/openai/openai-node | model/media providers and OpenAI dependency | Repo has `openai` dependency. OpenAI docs now center Responses API; Assistants is deprecated in docs. | Audit any Assistants-style code before new work. |
| MCP | https://modelcontextprotocol.io/docs/getting-started/intro | `@modelcontextprotocol/sdk`, MCP servers | Repo uses MCP server/client patterns. | Keep server contracts small and typed. |
| Docker Compose | https://docs.docker.com/compose/ | Docker/tenant runtime | Still valid for local/server gateway packaging. | Keep Compose for OpenClaw gateway runtime until Vercel parity is proven. |
| Caddy automatic HTTPS | https://caddyserver.com/docs/automatic-https | Hetzner/domain routing docs | Good fit for tenant HTTPS and reverse proxy. | Keep Caddy config audited before public exposure. |
| Firecrawl Node SDK | https://docs.firecrawl.dev/sdks/node | `extensions/firecrawl/`, rescue scanning | Firecrawl files are dirty in worktree and need their own PR. | Finish as a separate provider cleanup. |
| Microsoft Graph sendMail | https://learn.microsoft.com/en-us/graph/api/user-sendmail | `mcp-servers/microsoft-graph/` | MCP is app-only and requires per-user mailbox targeting. | Separate tenants/mailboxes before customer use. |
| Resend send email | https://resend.com/docs/api-reference/emails/send-email | outreach email | Docs support idempotency keys and recipient limits. | Use dedicated sender domains and send ledgers. |
| LiveKit Agents | https://docs.livekit.io/agents/ | voice/agent plans | LiveKit is a realtime agent framework. | Validate voice flows before production changes. |
| Google Gemini API | https://ai.google.dev/gemini-api/docs | Gemini/provider flows | Gemini provider references exist in docs/scripts. | Validate current model IDs before changing configs. |
| Google Places API | https://developers.google.com/maps/documentation/places/web-service/overview | lead enrichment and rescue pipeline | Places API version drift can break enrichment. | Audit usage in actual rescue app repo. |

## Hard Validation Limits

- I validated this repo directly, but I did not clone every adjacent Vercel project repo in this pass.
- I did not run live Supabase writes in this pass because the requested scope was mapping and documentation, not schema changes.
- I did not run full repo tests in this pass. Follow-up validation did run `pnpm docs:list`, postinstall tests, and the full WhatsApp plugin test suite after the package-manager fix.
- I did not add a root `vercel.ts` because this repo is not currently a Vercel app.
