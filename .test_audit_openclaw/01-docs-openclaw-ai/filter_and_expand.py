"""Filter the firecrawl_map output to English-only and expand canonical paths."""
import re, os, json

# Raw URL list captured from firecrawl_map
RAW_URLS = """https://docs.openclaw.ai
https://docs.openclaw.ai/reference/test
https://docs.openclaw.ai/cli/nodes.md
https://docs.openclaw.ai/concepts/multi-agent
https://docs.openclaw.ai/start/lore
https://docs.openclaw.ai/tools/index
https://docs.openclaw.ai/channels/irc
https://docs.openclaw.ai/platforms/mac/permissions
https://docs.openclaw.ai/cli/setup.md
https://docs.openclaw.ai/concepts/delegate-architecture
https://docs.openclaw.ai/concepts/session.md
https://docs.openclaw.ai/plugins/architecture.md
https://docs.openclaw.ai/channels/signal.md
https://docs.openclaw.ai/reference/wizard
https://docs.openclaw.ai/gateway/configuration-reference
https://docs.openclaw.ai/providers/litellm
https://docs.openclaw.ai/gateway/health
https://docs.openclaw.ai/channels/bluebubbles
https://docs.openclaw.ai/providers/moonshot
https://docs.openclaw.ai/tools/elevated
https://docs.openclaw.ai/help/testing
https://docs.openclaw.ai/help/testing-live
https://docs.openclaw.ai/cli/infer
https://docs.openclaw.ai/concepts/agent.md
https://docs.openclaw.ai/channels/troubleshooting
https://docs.openclaw.ai/cli/qr.md
https://docs.openclaw.ai/providers/vydra
https://docs.openclaw.ai/gateway/trusted-proxy-auth
https://docs.openclaw.ai/tools/lobster"""

# Canonical sections derived from GitHub docs/ tree (more authoritative)
CANONICAL_PATHS = [
    # Top-level pages
    "/", "/start/lore", "/start/wizard", "/start/onboarding-overview",
    "/index", "/network", "/web", "/vps", "/logging", "/ci",
    # Concepts
    "/concepts/agent", "/concepts/multi-agent", "/concepts/session",
    "/concepts/delegate-architecture", "/concepts/architecture",
    "/concepts/agent-workspace", "/concepts/context", "/concepts/context-engine",
    "/concepts/messages", "/concepts/queue", "/concepts/memory-search",
    "/concepts/memory-honcho", "/concepts/memory-qmd", "/concepts/compaction",
    "/concepts/models", "/concepts/features", "/concepts/presence",
    # Channels
    "/channels", "/channels/bluebubbles", "/channels/imessage", "/channels/irc",
    "/channels/signal", "/channels/whatsapp", "/channels/telegram",
    "/channels/discord", "/channels/slack", "/channels/feishu",
    "/channels/googlechat", "/channels/line", "/channels/nostr",
    "/channels/twitch", "/channels/zalouser", "/channels/groups",
    "/channels/channel-routing", "/channels/troubleshooting",
    # Tools
    "/tools/index", "/tools/web-fetch", "/tools/browser", "/tools/skills",
    "/tools/duckduckgo-search", "/tools/exa-search", "/tools/perplexity-search",
    "/tools/gemini-search", "/tools/minimax-search", "/tools/agent-send",
    "/tools/loop-detection", "/tools/code-execution", "/tools/exec",
    "/tools/exec-approvals", "/tools/elevated", "/tools/pdf",
    "/tools/image-generation", "/tools/media-overview", "/tools/thinking",
    "/tools/lobster",
    # Providers
    "/providers/litellm", "/providers/moonshot", "/providers/groq",
    "/providers/lmstudio", "/providers/ollama", "/providers/openrouter",
    "/providers/qwen", "/providers/minimax", "/providers/runway",
    "/providers/fal", "/providers/kilocode", "/providers/opencode",
    "/providers/github-copilot", "/providers/xiaomi", "/providers/vydra",
    "/providers/claude-max-api-proxy",
    # Install
    "/install/installer", "/install/macos-vm", "/install/kubernetes",
    "/install/railway", "/install/fly", "/install/hostinger",
    "/install/exe-dev", "/install/bun", "/install/uninstall", "/install/updating",
    # Gateway
    "/gateway", "/gateway/health", "/gateway/heartbeat", "/gateway/discovery",
    "/gateway/network-model", "/gateway/openai-http-api",
    "/gateway/tools-invoke-http-api", "/gateway/protocol",
    "/gateway/security", "/gateway/secrets-plan-contract",
    "/gateway/sandboxing", "/gateway/trusted-proxy-auth",
    "/gateway/cli-backends", "/gateway/bonjour", "/gateway/logging",
    "/gateway/configuration-reference",
    # CLI
    "/cli/nodes", "/cli/setup", "/cli/qr", "/cli/infer", "/cli/cron",
    "/cli/message", "/cli/skills", "/cli/hooks", "/cli/webhooks",
    "/cli/acp", "/cli/approvals", "/cli/voicecall", "/cli/sandbox",
    "/cli/security", "/cli/uninstall", "/cli/status", "/cli/config",
    # Plugins
    "/plugins/architecture", "/plugins/sdk-entrypoints",
    "/plugins/sdk-testing", "/plugins/community", "/plugins/zalouser",
    # Automation
    "/automation/standing-orders", "/automation/taskflow",
    "/automation/cron-jobs", "/automation/tasks",
    # Nodes
    "/nodes/index", "/nodes/voicewake", "/nodes/images",
    # Reference
    "/reference/wizard", "/reference/test", "/reference/AGENTS.default",
    "/reference/memory-config", "/reference/secretref-credential-surface",
    "/reference/prompt-caching",
    "/reference/templates/AGENTS", "/reference/templates/SOUL",
    "/reference/templates/IDENTITY", "/reference/templates/BOOT",
    # Security
    "/security/CONTRIBUTING-THREAT-MODEL", "/security/formal-verification",
    # Platforms
    "/platforms/mac/permissions", "/platforms/mac/icon",
    "/platforms/mac/voicewake", "/platforms/mac/canvas",
    "/platforms/mac/menu-bar", "/platforms/mac/peekaboo",
    "/platforms/mac/signing", "/platforms/mac/logging",
    "/platforms/mac/remote", "/platforms/ios",
    # Help / debug
    "/help/testing", "/help/debugging",
    "/debug/node-issue",
]

LANG_RE = re.compile(r"^https://docs\.openclaw\.ai/(tr|ar|de|es|fr|id|it|ja-JP|ko|pl|pt-BR|uk|zh-CN|ru)(/|$)")

en_seen = set()
en_urls = []

# Add canonical paths
for p in CANONICAL_PATHS:
    u = "https://docs.openclaw.ai" + (p if p != "/" else "")
    if u not in en_seen:
        en_seen.add(u)
        en_urls.append(u)

# Merge any English URLs from the firecrawl map output
for line in RAW_URLS.splitlines():
    u = line.strip()
    if not u or LANG_RE.match(u):
        continue
    u = u.split('#')[0].rstrip('/')
    if u.endswith('.md'):
        u = u[:-3]
    if u and u not in en_seen:
        en_seen.add(u)
        en_urls.append(u)

OUT = r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\01-docs-openclaw-ai"
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "urls-en.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(en_urls) + "\n")

print(f"Total English URLs: {len(en_urls)}")
print(f"Saved to: {os.path.join(OUT, 'urls-en.txt')}")
print("---- Sample (first 20) ----")
for u in en_urls[:20]:
    print(u)
