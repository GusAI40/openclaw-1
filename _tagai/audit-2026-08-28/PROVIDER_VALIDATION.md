# Provider And Documentation Validation

Audit date: 2026-08-28

Rule followed: no provider, framework, security, deployment, or API recommendation in this audit is based only on memory. Current official documentation was checked for the major systems that the live repo and VPS depend on.

Important limit: this is not a line-by-line audit of every provider plugin in `extensions/*`. Before changing code inside a specific provider plugin, reread that provider's current endpoint docs and the local provider code/tests for that exact surface.

## Official Sources Checked

| Provider/framework | Official source checked | Repo/VPS area that depends on it | Audit conclusion |
| --- | --- | --- | --- |
| OpenClaw Gateway security | https://docs.openclaw.ai/gateway/security | Gateway exposure, tool permissions, untrusted content | Gateway tools can expose secrets/topology; high-risk tools should be denied by default for untrusted surfaces. |
| OpenClaw security audit checks | https://docs.openclaw.ai/gateway/security/audit-checks | `openclaw security audit` findings | Findings should be treated as structured source of truth for config hardening. |
| OpenClaw Gateway runbook | https://docs.openclaw.ai/gateway | Gateway health/readiness | Health and WebSocket checks should be part of operational proof. |
| OpenClaw secrets CLI | Local `docs/cli/secrets.md` and OpenClaw docs | `openclaw secrets audit --check` | Plaintext secrets and unresolved references are blockers, not paperwork. |
| Ubuntu OpenSSH | https://ubuntu.com/server/docs/how-to/security/openssh-server/ | SSH hardening | Validate config with `sshd -t`; key-based access should be preferred before disabling password auth. |
| Ubuntu UFW | https://ubuntu.com/server/docs/how-to/security/firewalls/ | Host firewall | UFW is the host firewall control; current allow-list is 22/80/443. |
| Ubuntu automatic updates | https://ubuntu.com/server/docs/how-to/software/automatic-updates/ | Patch process | Security updates should be applied or intentionally managed; pending security updates block A+++. |
| Ubuntu package management | https://ubuntu.com/server/docs/how-to/software/package-management/ | APT upgrades | Use APT for package update workflow; review impact before broad upgrades. |
| Docker rootless mode | https://docs.docker.com/engine/security/rootless/ | Container isolation | Rootless Docker reduces daemon/container root exposure and should be evaluated. |
| Docker user namespace remap | https://docs.docker.com/engine/security/userns-remap/ | Container isolation | User namespace remap helps isolate container root, but the daemon still runs as root. |
| Docker Engine release notes | https://docs.docker.com/engine/release-notes/29/ | Docker patching | Docker 29 has security fixes after the installed version; patching is justified. |
| Caddy reverse proxy | https://caddyserver.com/docs/caddyfile/directives/reverse_proxy | Public domain routing | `reverse_proxy` controls upstream behavior and request/response header handling. |
| Caddy response headers | https://caddyserver.com/docs/caddyfile/directives/header | Security headers | Missing headers on some public domains are a concrete fix target. |
| Hetzner Cloud Firewalls | https://docs.hetzner.com/cloud/firewalls/overview/ | Cloud-edge firewall | Add a cloud firewall as another wall in front of UFW where possible. |
| GitHub secret scanning | https://docs.github.com/code-security/secret-scanning/about-secret-scanning | Public fork | Secret scanning is enabled on `GusAI40/openclaw-1`. |
| GitHub push protection | https://docs.github.com/en/code-security/concepts/secret-security/push-protection | Public fork | Push protection is enabled and should stay on. |
| GitHub Dependabot security updates | https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates | Dependency patching | Disabled on the public fork; enable or document equivalent process. |
| Vercel CLI | https://vercel.com/docs/cli | Adjacent deployment plans | Use `VERCEL_TOKEN` env for automation; this OpenClaw repo is not itself proven as a Vercel app. |
| Vercel env vars | https://vercel.com/docs/environment-variables | Adjacent app deployment | Put secrets in environment configuration, not source. |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | Supabase/Postgres revenue data | Exposed schemas need RLS and correct grants; RLS is not optional for tenant data. |
| Supabase MCP/AI tooling | https://supabase.com/docs/guides/ai-tools/mcp | Agent database operations | MCP can inspect/act on projects, so PAT scope and operator control matter. |
| OpenAI API | https://platform.openai.com/docs/api-reference | OpenAI provider | OpenAI integration should align with current API docs before provider changes. |
| Anthropic models | https://docs.anthropic.com/en/docs/about-claude/models/overview | Anthropic provider/fallbacks | Validate model IDs and capability/cost tier before changing fallback policy. |
| Google Gemini models | https://ai.google.dev/gemini-api/docs/models | Gemini provider/fallbacks | Validate model IDs and current tier before changing Julian fallbacks. |
| DeepSeek models/pricing | https://api-docs.deepseek.com/quick_start/pricing/ | Julian primary LLM | Current docs list DeepSeek V4 Pro/Flash models and their API base. |
| Mistral models | https://docs.mistral.ai/models | Gus fallbacks | Validate `mistral-large-latest` and `codestral-latest` before routing changes. |
| OpenRouter API/auth/models | https://openrouter.ai/docs/api_reference/overview and https://openrouter.ai/docs/api_reference/authentication | `openrouter/auto` fallback | API keys are powerful and can cover model costs; use limits and protect keys. |
| Groq models/API | https://console.groq.com/docs/models and https://console.groq.com/docs/api-reference | Groq auth profile | Confirm live model IDs through Models API before enabling or routing traffic. |
| Tavily search | https://docs.tavily.com/documentation/api-reference/endpoint/search | Web search tools | Tavily search supports basic/advanced modes; choose by latency and precision needs. |
| Exa Search API | https://exa.ai/docs/reference/search-api-guide | Web research tools | Exa is AI-oriented search; use for research workflows with current endpoint validation. |
| Brave Search API | https://api-dashboard.search.brave.com/documentation | Web research tools | Brave offers web search and LLM context; storage rights depend on plan terms. |
| Telegram Bot API | https://core.telegram.org/bots/api | Telegram channel | Bot API changes frequently; recent 2026 updates reinforce checking docs before channel edits. |
| Discord Gateway/API | https://docs.discord.com/developers/events/gateway | Discord channel | Discord events use secure WebSocket gateway; intents and event handling need current validation. |
| Discord bots | https://docs.discord.com/developers/bots/overview | Discord channel | Bot behavior and permissions must be validated against current Discord platform docs. |
| Deepgram STT/TTS | https://developers.deepgram.com/docs/stt/getting-started and https://developers.deepgram.com/docs/tts-rest | Voice/speech tools | Deepgram supports STT, TTS, and voice-agent flows; keys must stay out of source. |
| LiveKit Agents | https://docs.livekit.io/agents/ | Voice agent plans | LiveKit supports STT-LLM-TTS pipelines and realtime voice agents. |
| Twilio Messaging | https://www.twilio.com/docs/messaging/api | SMS/WhatsApp plans | Messaging APIs are HTTPS-based and should include delivery/status tracking. |
| Resend Email API | https://resend.com/docs/api-reference/emails/send-email | Outreach email plans | Email sending should use verified domains, API keys, and send ledgers. |
| Stripe API | https://docs.stripe.com/api | Payment paths | Stripe is the likely payment rail for subscriptions/invoices/payment links. |
| Node.js | https://nodejs.org/en/about | Runtime | Node is the JavaScript runtime for the gateway/CLI; use official domains only. |
| pnpm workspaces/security | https://pnpm.io/workspaces and https://pnpm.io/supply-chain-security | Monorepo package management | Repo already uses workspaces and `minimumReleaseAge`, which is a useful supply-chain control. |
| Hono | https://hono.dev/docs/ | Web framework dependency | Hono supports Web-standard APIs across Node and other runtimes. |
| Vitest | https://vitest.dev/guide/ | Test runner | Use repo test lanes rather than raw ad hoc test commands. |

## Validation-Backed Calls

- Do not put Vercel/Supabase/GitHub/AI provider tokens in files, docs, shell history, or chat. Rotate any pasted tokens.
- Do not call the OpenClaw live VPS A+++ while official OpenClaw audits report critical/warn findings.
- Do not expose the Gateway until you can explain who reaches it, how auth works, what tools can run, and how logs/secrets are protected.
- Do not treat UFW as the only protection. Bind private services to loopback and add Hetzner Cloud Firewall controls where possible.
- Do not change model IDs or provider code from memory. Check provider model/list endpoints or official model docs first.
- Do not make this repo a fake Vercel project. Vercel changes belong in actual Vercel app repos unless this repo gains a real Vercel deployment target.
