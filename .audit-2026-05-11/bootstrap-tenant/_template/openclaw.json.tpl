{
  "meta": {
    "lastTouchedVersion": "{{OPENCLAW_IMAGE_VERSION}}",
    "lastTouchedAt": "{{NOW_ISO8601}}",
    "tenant_id": "{{TENANT_ID}}",
    "tenant_name": "{{TENANT_NAME}}",
    "owner_email": "{{OWNER_EMAIL}}",
    "bootstrapped_by": "bootstrap-tenant.sh"
  },
  "gateway": {
    "bind": "lan",
    "port": 18789,
    "token": "{{GATEWAY_TOKEN}}",
    "allowInsecurePrivateWs": false
  },
  "agents": {
    "defaults": {
      "model": "claude-opus-4-7",
      "effort": "high",
      "permissions": {
        "fileSystem": "workspace-only",
        "network": "allow",
        "bash": "allow"
      },
      "systemPrompt": "You are Jarvis for {{TENANT_NAME}}. Owner of record: {{OWNER_EMAIL}}. You are the concierge and strategist for this tenant only — you have NO access to other tenants' data, kanban boards, or workspaces. Your responsibilities:\n\n1. Coordinate Hermes (CTO) and the 100-agent corp roster scoped to this tenant.\n2. Maintain hard isolation: never reference, query, or act upon another tenant's data. All Supabase queries must filter by tenant_id='{{TENANT_ID}}'. All LiveKit rooms must be prefixed with 'room-{{TENANT_ID}}'.\n3. Approval gates: any outbound email, SMS, or call requires explicit human approval from {{OWNER_EMAIL}}.\n4. Default to plan mode for any task that creates, modifies, or sends external artifacts.\n5. When uncertain about scope, escalate to the owner via the configured Telegram channel.\n\nYou represent {{TENANT_NAME}}. Speak in their voice, not Gus Sanchez's. Brand alignment overrides defaults."
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botTokenEnv": "TENANT_TELEGRAM_BOT_TOKEN",
      "allowedUsersEnv": "TENANT_TELEGRAM_ALLOWED_USERS",
      "homeChannelEnv": "TENANT_TELEGRAM_HOME_CHANNEL",
      "tenantScope": "{{TENANT_ID}}"
    },
    "discord": {
      "enabled": false,
      "note": "Disabled by default per tenant — enable via owner request"
    },
    "web": {
      "enabled": true,
      "publicUrl": "https://{{DOMAIN}}/hermes",
      "corsAllow": ["https://{{DOMAIN}}"]
    },
    "voice": {
      "enabled": true,
      "provider": "livekit",
      "roomPrefix": "room-{{TENANT_ID}}",
      "note": "Per-tenant room namespacing prevents cross-tenant audio leakage"
    }
  },
  "plugins": {
    "entries": [
      { "name": "hermes-army", "path": "/home/node/.openclaw/workspace/.agents/skills/hermes-army", "enabled": true },
      { "name": "corp-roster", "path": "/home/node/.openclaw/corp", "enabled": true }
    ]
  },
  "mcp": {
    "servers": [
      {
        "name": "supabase",
        "command": "node",
        "args": ["/home/node/.openclaw/mcp-servers/supabase/index.js"],
        "env": { "SUPABASE_TENANT_FILTER": "{{TENANT_ID}}" },
        "enabled": true
      },
      {
        "name": "telnyx",
        "command": "node",
        "args": ["/home/node/.openclaw/mcp-servers/telnyx/index.js"],
        "enabled": true,
        "note": "Shared trunk — global concurrent-call semaphore enforced by Hermes"
      },
      {
        "name": "livekit",
        "command": "node",
        "args": ["/home/node/.openclaw/mcp-servers/livekit/index.js"],
        "env": { "LIVEKIT_ROOM_PREFIX": "room-{{TENANT_ID}}" },
        "enabled": true
      }
    ]
  },
  "tools": {
    "web": {
      "enabled": true,
      "provider": "tavily",
      "tenantScope": "{{TENANT_ID}}"
    }
  },
  "hardGates": {
    "outboundEmail": { "requireHumanApproval": true, "approverEmail": "{{OWNER_EMAIL}}" },
    "outboundSms": { "requireHumanApproval": true },
    "outboundCall": { "requireHumanApproval": true },
    "crossTenantAccess": { "blocked": true, "note": "Hermes spawn loop must reject any task whose tenant_id != '{{TENANT_ID}}'" }
  }
}
