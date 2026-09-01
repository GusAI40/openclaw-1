{
  "agents": {
    "defaults": {
      "workspace": "/home/node/.openclaw/workspace",
      "model": {
        "primary": "deepseek/deepseek-v4-flash",
        "fallbacks": [
          "google/gemini-2.5-flash-lite",
          "anthropic/claude-haiku-4.5",
          "anthropic/claude-sonnet-4.6"
        ]
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "1h"
      },
      "heartbeat": {
        "every": "30m"
      },
      "compaction": {
        "mode": "safeguard"
      },
      "systemPromptOverride": "You are Jarvis for {{TENANT_NAME}}. You are not 'an AI assistant.' You are Jarvis, {{TENANT_NAME}}'s permanent digital concierge \u2014 half-human empathy, half-machine precision. One brain across every channel.\n\nOwner of record: {{OWNER_EMAIL}}. Tenant: {{TENANT_ID}}.\n\nReply with the precision of a butler. One-line answers when possible. Multi-paragraph only when explicitly asked. Refer to yourself as 'Jarvis.' Never 'Claude,' 'the AI,' or 'as a language model.'\n\nConfirm scope before destructive actions. Show drafts before sending. When uncertain, say so in one sentence and propose a verified next step.\n\nHard gates: Never send any outbound email without owner approval. Reference .env for secrets, never paste them in chat.\n\nClosing principle: You are the live execution layer for {{TENANT_NAME}}'s automation. Move with the precision of a butler and the breadth of an agency. Never break character.",
      "contextInjection": "continuation-skip",
      "bootstrapMaxChars": 32768,
      "bootstrapTotalMaxChars": 80000
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "{{GATEWAY_TOKEN}}"
    },
    "trustedProxies": [
      "173.245.48.0/20",
      "103.21.244.0/22",
      "103.22.200.0/22",
      "103.31.4.0/22",
      "141.101.64.0/18",
      "108.162.192.0/18",
      "190.93.240.0/20",
      "188.114.96.0/20",
      "197.234.240.0/22",
      "198.41.128.0/17",
      "162.158.0.0/15",
      "104.16.0.0/13",
      "104.24.0.0/14",
      "172.64.0.0/13",
      "131.0.72.0/22",
      "172.19.0.0/16"
    ],
    "controlUi": {
      "allowedOrigins": [
        "https://{{DOMAIN}}",
        "http://localhost:{{GATEWAY_PORT}}",
        "http://127.0.0.1:{{GATEWAY_PORT}}"
      ]
    }
  },
  "meta": {
    "lastTouchedVersion": "{{OPENCLAW_IMAGE_VERSION}}",
    "lastTouchedAt": "{{NOW_ISO8601}}"
  },
  "channels": {
    "telegram": {
      "enabled": true
    },
    "discord": {
      "token": {
        "source": "env",
        "provider": "default",
        "id": "DISCORD_BOT_TOKEN"
      },
      "enabled": false
    }
  },
  "plugins": {
    "entries": {
      "deepseek": {
        "enabled": true
      },
      "bonjour": {
        "enabled": false
      },
      "google": {
        "enabled": true
      },
      "anthropic": {
        "enabled": true
      },
      "tavily": {
        "enabled": true,
        "config": {
          "webSearch": {
            "apiKey": "{{REDACT_FILL_AT_DEPLOY}}"
          }
        }
      },
      "memory-core": {
        "config": {
          "dreaming": {
            "enabled": true
          }
        },
        "enabled": true
      },
      "browser": {
        "enabled": true
      }
    }
  },
  "mcp": {
    "servers": {
      "jarvis-vapi": {
        "command": "node",
        "args": [
          "/home/node/.openclaw/jarvis-vapi/vapi-mcp-server.mjs"
        ]
      },
      "github": {
        "url": "https://api.githubcopilot.com/mcp/",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "microsoft-graph": {
        "command": "node",
        "args": [
          "/home/node/.openclaw/mcp-servers/microsoft-graph/src/index.mjs"
        ],
        "env": {
          "MS_TENANT_ID": "54d81568-52a6-454f-8f81-7bb6896db20a",
          "MS_CLIENT_ID": "fe090265-730a-4f1f-b04d-c1bd3c93a34b",
          "MS_CLIENT_SECRET": "{{REDACT_FILL_AT_DEPLOY}}",
          "MS_DEFAULT_USER": "gus@ubntag.com"
        }
      },
      "supabase": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server-supabase@latest"
        ],
        "env": {
          "SUPABASE_ACCESS_TOKEN": "",
          "SUPABASE_PROJECT_REF": "bjhjqegqfieyekbffgij"
        }
      },
      "vercel": {
        "url": "https://mcp.vercel.com/",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "resend": {
        "command": "npx",
        "args": [
          "-y",
          "resend-mcp"
        ],
        "env": {
          "RESEND_API_KEY": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "tag-ai-functions": {
        "command": "node",
        "args": [
          "/app/langfuse-proxy.mjs",
          "node",
          "/home/node/.openclaw/mcp-servers/tag-ai-functions/src/index.mjs"
        ],
        "env": {
          "MICHELLE_CMA_URL": "http://172.19.0.1:8080",
          "CMA_API_KEY": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "kie-ai": {
        "command": "node",
        "args": [
          "/home/node/.openclaw/mcp-servers/kie-ai/src/index.mjs"
        ],
        "env": {
          "KIE_API_KEY": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "langfuse": {
        "command": "node",
        "args": [
          "/app/langfuse-mcp.mjs"
        ],
        "env": {
          "LANGFUSE_SECRET_KEY": "{{REDACT_FILL_AT_DEPLOY}}",
          "LANGFUSE_PUBLIC_KEY": "{{REDACT_FILL_AT_DEPLOY}}",
          "LANGFUSE_BASE_URL": "https://us.cloud.langfuse.com"
        }
      },
      "hindsight": {
        "url": "http://localhost:8888/mcp/",
        "transport": "streamable-http"
      },
      "n8n-mcp": {
        "url": "https://tagaiai.app.n8n.cloud/mcp-server/http",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      },
      "telnyx": {
        "command": "node",
        "args": [
          "/home/node/.openclaw/mcp-servers/telnyx/node_modules/telnyx-mcp/index.js"
        ],
        "env": {
          "TELNYX_API_KEY": "{{REDACT_FILL_AT_DEPLOY}}"
        }
      }
    }
  },
  "tools": {
    "web": {
      "search": {
        "provider": "tavily"
      }
    }
  }
}