# Provider Validation Report - 2026-07-03

Context7 MCP was not available in this session. I used current official web documentation instead. This file records what was checked before making recommendations and documentation edits.

Important limit: this is an audit map, not a full code-level endpoint review for every plugin. Before changing a provider plugin, re-check that provider's exact endpoint, SDK version, auth method, rate limits, schema, and error behavior.

## Official Documentation Checked

| Provider, framework, or platform | Official docs checked | Repo areas depending on it | Current finding | Action needed |
| --- | --- | --- | --- | --- |
| Vercel CLI | https://vercel.com/docs/cli | Vercel ops and adjacent web app deployment | CLI is relevant, but this repo is not itself a Vercel app | Use only in real Vercel app repos; use env-based auth |
| Vercel `vercel.ts` | https://vercel.com/docs/project-configuration/vercel-ts | Adjacent Vercel app repos | No root `vercel.ts` should be added here just for appearance | Add project config inside real Vercel apps only |
| Vercel AI Gateway | https://vercel.com/docs/ai-gateway | `extensions/vercel-ai-gateway/` | Fits model routing and observability | Validate live model IDs before defaults change |
| Vercel Fluid Compute | https://vercel.com/docs/fluid-compute | API/AI-heavy Vercel app repos | Good for long API/model work in Vercel apps | Use in actual app repos after project checks |
| Vercel Queues | https://vercel.com/docs/queues | Future rescue app jobs | Good fit for background lead/report jobs | Prototype after sender safety |
| Vercel Workflows | https://vercel.com/docs/workflows | Future rescue pipeline | Good fit for scan -> report -> outreach | Build in Vercel app repo, not this gateway repo |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | Rescue data, tenant data, MCP | RLS must be explicit and policy-backed | Keep RLS, grants, and tenant claims together |
| Supabase API security | https://supabase.com/docs/guides/api/securing-your-api | Public database access | RLS is not a replacement for careful grants | Add grant checks to migrations |
| Supabase MCP | https://supabase.com/docs/guides/ai-tools/mcp | `_tagai/bootstrap/_template/openclaw.json.tpl` | MCP should use scoped auth and no committed PATs | Rotate pasted Supabase PAT |
| GitHub PATs | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens | Git, `gh`, CI | PAT pasted in chat is an exposed secret | Rotate immediately |
| GitHub Actions | https://docs.github.com/en/actions | `.github/workflows/` | CI is the repo safety net | Keep scoped checks before push |
| GitHub secret scanning | https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning | Repo security | Secrets in chat may not be caught by repo scanning | Rotate manually |
| pnpm settings | https://pnpm.io/settings | `pnpm-workspace.yaml` | pnpm settings belong in workspace config | Keep supply-chain settings there |
| pnpm workspaces | https://pnpm.io/workspaces | monorepo layout | Repo uses workspace packages | Keep packages explicit |
| Node.js ESM | https://nodejs.org/api/esm.html | `"type": "module"` and imports | ESM contract matters everywhere | Avoid CommonJS assumptions |
| TypeScript | https://www.typescriptlang.org/docs/ | `src/`, `extensions/`, `ui/` | Typed core | Use repo `tsgo` lanes |
| Vitest | https://vitest.dev/guide/ | tests | Repo uses Vitest through scripts | Do not run raw `vitest` |
| tsdown | https://tsdown.dev/ | package builds | Builds library output | Run build when exports change |
| Vite | https://vite.dev/guide/ | `ui/` | Control UI build/dev server | Validate UI changes with UI scripts |
| Lit | https://lit.dev/docs/ | `ui/` | Web component UI | Keep Lit patterns in UI |
| MCP | https://modelcontextprotocol.io/docs/getting-started/intro | `@modelcontextprotocol/sdk`, MCP servers | Tool-server protocol | Keep schemas small and typed |
| Docker Compose | https://docs.docker.com/compose/ | Docker/tenant runtime | Valid for gateway deployments | Keep Compose runbooks current |
| Caddy automatic HTTPS | https://caddyserver.com/docs/automatic-https | `_tagai/CADDY_AUDIT.md` | Public HTTPS routing | Audit before changing public routes |
| OpenAI API | https://platform.openai.com/docs/api-reference | `extensions/openai/`, `openai` dependency | Current docs center Responses and Agents surfaces | Audit exact endpoint before code changes |
| OpenAI Node SDK | https://github.com/openai/openai-node | `openai` dependency | Official TS/JS client | Match SDK usage to installed version |
| Anthropic API | https://platform.claude.com/docs/en/api/overview | `extensions/anthropic/` | Claude API provider | Validate model IDs live |
| Google Gemini API | https://ai.google.dev/gemini-api/docs | `extensions/google/`, Gemini docs | Gemini provider | Validate model IDs before defaults change |
| Vertex AI / Google Cloud Gemini | https://cloud.google.com/vertex-ai/generative-ai/docs | `extensions/anthropic-vertex/`, Google cloud flows | Cloud-hosted model access | Validate auth and region |
| Amazon Bedrock | https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html | Bedrock plugins | Managed model access | Validate region/model ARN formats |
| Cloudflare AI Gateway | https://developers.cloudflare.com/ai-gateway/ | `extensions/cloudflare-ai-gateway/` | AI gateway provider | Validate auth and route format |
| DeepSeek | https://api-docs.deepseek.com/ | `extensions/deepseek/` | Docs show `deepseek-chat` and `deepseek-reasoner` deprecating on 2026-07-24 | Replace old IDs before that date |
| Groq | https://console.groq.com/docs/overview | `extensions/groq/` | Model provider | Validate rate limits and model IDs |
| Mistral | https://docs.mistral.ai/ | `extensions/mistral/` | Model provider | Validate SDK/API surface |
| OpenRouter | https://openrouter.ai/docs | `extensions/openrouter/` | Model router | Validate headers and model slugs |
| Fireworks | https://docs.fireworks.ai/ | `extensions/fireworks/` | Model provider | Validate model/API contract |
| Hugging Face | https://huggingface.co/docs | `extensions/huggingface/` | Model provider | Validate inference endpoint format |
| NVIDIA NIM | https://docs.nvidia.com/nim/ | `extensions/nvidia/` | Model/runtime provider | Validate NIM endpoint compatibility |
| Together AI | https://docs.together.ai/intro | `extensions/together/` | Model provider | Validate model IDs |
| xAI | https://docs.x.ai/overview | `extensions/xai/` | Model/search provider | Validate current API surface |
| Alibaba/Qwen | https://www.alibabacloud.com/help/en/model-studio/qwen-api-reference/ | `extensions/alibaba/`, `extensions/qwen/` | Qwen/OpenAI-compatible APIs | Validate regional base URLs |
| Tencent Hunyuan | https://www.tencentcloud.com/document/product/1284/75530 | `extensions/tencent/` | Model/media provider | Validate official access path |
| Baidu Qianfan | https://intl.cloud.baidu.com/doc/qianfan/index.html | `extensions/qianfan/` | Model provider | Validate auth and base URL |
| Z.AI | https://docs.z.ai/guides/overview/quick-start | `extensions/zai/` | GLM provider | Validate endpoint and model IDs |
| LiteLLM | https://docs.litellm.ai/docs/ | `extensions/litellm/` | Gateway/provider adapter | Validate proxy and API shape |
| Ollama | https://ollama.readthedocs.io/en/api/ | `extensions/ollama/` | Local model runtime | Validate local API compatibility |
| LM Studio | https://lmstudio.ai/docs | `extensions/lmstudio/` | Local model runtime | Validate local server mode |
| vLLM | https://docs.vllm.ai/en/latest/ | `extensions/vllm/` | Self-host model runtime | Validate OpenAI-compatible mode |
| SGLang | https://docs.sglang.io/ | `extensions/sglang/` | Self-host model runtime | Validate server API |
| Perplexity | https://docs.perplexity.ai/docs/getting-started/overview | `extensions/perplexity/` | Search/model provider | Validate Sonar API contract |
| MiniMax | https://platform.minimax.io/docs/api-reference/api-overview | `extensions/minimax/` | Model/media provider | Validate API key type and endpoint |
| fal | https://fal.ai/docs/documentation | `extensions/fal/` | Media generation provider | Validate queue/result API |
| Runway | https://docs.dev.runwayml.com/ | `extensions/runway/` | Video generation provider | Validate API access tier |
| ElevenLabs | https://elevenlabs.io/docs/api-reference/introduction | `extensions/elevenlabs/` | TTS/voice | Validate streaming/auth |
| Deepgram | https://developers.deepgram.com/home | `extensions/deepgram/` | STT/TTS/voice | Validate real-time audio contracts |
| LiveKit Agents | https://docs.livekit.io/agents/ | voice/agent plans and skills | Realtime agent framework | Validate before production voice changes |
| Twilio Voice | https://www.twilio.com/docs/voice | voice-call tools | Programmable voice | Validate webhook/security setup |
| Telnyx Voice | https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals | voice-call tools | Programmable voice | Validate call-control auth |
| Telegram Bot API | https://core.telegram.org/bots/api | `extensions/telegram/` | Bot API latest changes include 2026 Bot API 10.x features | Do not assume older message model |
| Slack Web API | https://docs.slack.dev/apis/web-api/ | `extensions/slack/` | Slack channel/actions | Validate rate limits and scopes |
| Discord Developer Docs | https://docs.discord.com/developers/intro | `extensions/discord/` | Discord channel | Validate intents and interaction behavior |
| Google Chat API | https://developers.google.com/workspace/chat/api/reference/rest | `extensions/googlechat/` | Google Chat channel | Validate service account/scopes |
| Microsoft Teams bots | https://learn.microsoft.com/en-us/microsoftteams/platform/bots/overview | `extensions/msteams/` | Teams channel | Validate Bot Framework/Graph split |
| Microsoft Graph sendMail | https://learn.microsoft.com/en-us/graph/api/user-sendmail | `mcp-servers/microsoft-graph/` | Mail automation | Tenant mailbox isolation is high risk |
| WhatsApp via Baileys | https://github.com/WhiskeySockets/Baileys | `extensions/whatsapp/` | WhatsApp Web integration | Keep dependency gate and tests strict |
| Meta WhatsApp Cloud API | https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started | possible future official WhatsApp path | Official business messaging API | Consider for compliant business messaging |
| Matrix Client-Server API | https://spec.matrix.org/latest/client-server-api/ | `extensions/matrix/` | Matrix channel | Validate E2EE and sync behavior |
| Signal CLI | https://github.com/AsamK/signal-cli | `extensions/signal/` | Signal channel | Unofficial CLI; treat as brittle |
| LINE Messaging API | https://developers.line.biz/en/docs/messaging-api/overview/ | `extensions/line/` | LINE channel | Validate webhook signature and rate limits |
| Mattermost API | https://developers.mattermost.com/integrate/reference/ | `extensions/mattermost/` | Mattermost channel | Validate bot auth |
| Nextcloud Talk API | https://nextcloud-talk.readthedocs.io/ | `extensions/nextcloud-talk/` | Nextcloud Talk channel | Validate OCS headers and versions |
| Nostr NIPs | https://github.com/nostr-protocol/nips | `extensions/nostr/` | Nostr DM channel | NIP-04 is legacy/unrecommended; revisit encryption |
| QQ Bot | https://bot.q.qq.com/wiki/ | `extensions/qqbot/` | QQ channel | Validate official platform rules |
| Twitch Chat | https://dev.twitch.tv/docs/chat | `extensions/twitch/` | Twitch channel | Rate limits must be respected |
| Google Places API | https://developers.google.com/maps/documentation/places/web-service/overview | rescue enrichment | Lead research | Audit actual rescue app repo before use |
| Resend send email | https://resend.com/docs/api-reference/emails/send-email | outreach email | Email delivery | Use idempotency, ledgers, suppression |
| Firecrawl Node SDK | https://docs.firecrawl.dev/sdks/node | `extensions/firecrawl/` | Current worktree has Firecrawl changes | Split into provider PR and verify `/v2/agent` docs |
| Brave Search API | https://brave.com/search/api/ | `extensions/brave/` | Web search | Validate current endpoint and plan |
| Exa | https://exa.ai/docs/reference/getting-started | `extensions/exa/` | Neural search | Validate API key and endpoint |
| Tavily | https://docs.tavily.com/documentation/api-reference/endpoint/search | `extensions/tavily/` | Search/extract | Validate search/extract split |
| SearXNG | https://docs.searxng.org/ | `extensions/searxng/` | Self-host search | Validate instance config |
| DuckDuckGo | https://duckduckgo.com/duckduckgo-help-pages/settings/params | `extensions/duckduckgo/` | Search fallback | Treat HTML scraping as brittle |
| Android build | https://developer.android.com/build | `apps/android/` | Android app | Validate Gradle/AGP before mobile changes |
| Android Gradle plugin | https://developer.android.com/build/releases/agp-9-2-0-release-notes | `apps/android/` | Android build plugin | Check app version before upgrades |
| SwiftUI | https://developer.apple.com/documentation/swiftui | `apps/ios/`, `apps/macos/` | Apple UI | Use current SwiftUI patterns |
| Swift language | https://docs.swift.org/swift-book/documentation/the-swift-programming-language/ | iOS/macOS apps | Swift source | Validate before app edits |
| Apple Observation | https://developer.apple.com/documentation/observation | SwiftUI app state | Modern state model | Prefer Observation where local rules require |
| Kotlin | https://kotlinlang.org/docs/home.html | Android app | Kotlin source | Validate before app edits |
| Gradle | https://docs.gradle.org/current/userguide/userguide.html | Android/macOS build surfaces | Build system | Validate before Gradle changes |
| Fly.io | https://fly.io/docs/ | `fly.toml` | Optional deploy target | Check CLI/version before deploy |
| Render | https://render.com/docs | `render.yaml` | Optional deploy target | Validate if used |
| Mapbox | https://docs.mapbox.com/api/overview/ | map-related skills/docs | Maps | Validate before adding maps |
| Stripe | https://docs.stripe.com/api | commerce plans/docs | Payments | Validate before payment work |
| Pinecone | https://docs.pinecone.io/guides/get-started/overview | requested skill/provider family | Vector DB | Not proven active in code; validate before use |
| Upstash | https://upstash.com/docs/introduction | requested provider family | Redis/queues | Not proven active in code; validate before use |

## Provider Findings That Matter Most

1. Exposed PATs are a live security risk.
2. DeepSeek old model aliases have a concrete deprecation date: 2026-07-24.
3. Nostr NIP-04 is marked legacy/unrecommended in the protocol source. Treat Nostr DM security as a review item.
4. Firecrawl work is currently dirty and must be validated against exact Firecrawl Agent docs before push.
5. Vercel is important for adjacent web apps, but this OpenClaw repo is not itself a Vercel app.
6. Supabase RLS, grants, and policies must be handled together.
7. Microsoft Graph app-only mailbox use needs strict tenant/mailbox boundaries.
