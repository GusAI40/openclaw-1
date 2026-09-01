# @tag/mcp-microsoft-graph

Self-contained MCP stdio server that exposes a small, focused subset of Microsoft Graph (mail, calendar, OneDrive) as tools for OpenClaw agents. Auth is **app-only** via Entra ID client-credentials.

## Tools

| Tool | What it does |
| --- | --- |
| `mail_search` | `$search` a user's mailbox; returns `[{id, from, subject, receivedDateTime, bodyPreview}]` |
| `mail_send` | Send an email as a user (text or HTML) |
| `calendar_list_events` | List upcoming events, or events in `[start, end]` if both provided |
| `calendar_create_event` | Create an event on a user's primary calendar |
| `drive_list` | List items at a path on a user's OneDrive |
| `drive_get_file` | Get metadata + short-lived download URL for a drive item (no byte transfer) |

Because auth is app-only (no signed-in user), every tool requires a `user` argument: a UPN (`alice@tenant.onmicrosoft.com`) or Graph user id. Set `MS_DEFAULT_USER` to make `user` optional.

## Required env vars

```
MS_CLIENT_ID        # Azure AD app registration client id
MS_CLIENT_SECRET    # Client secret for the app registration
MS_TENANT_ID        # Entra tenant id
MS_DEFAULT_USER     # Optional: fallback UPN when a tool call omits `user`
```

## Required Azure AD application permissions

All **Application** scope, admin-consented:

- `Mail.ReadWrite`
- `Mail.Send`
- `Calendars.ReadWrite`
- `Files.ReadWrite.All`

## Install

```
npm install
```

## Run locally (manual stdio)

```
MS_CLIENT_ID=... MS_CLIENT_SECRET=... MS_TENANT_ID=... node src/index.mjs
```

The server speaks JSON-RPC on stdin/stdout. Logs go to stderr.

Quick sanity check (lists tools):

```
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node src/index.mjs
```

## Register with OpenClaw (do later, not here)

Add this entry to the `mcpServers` block of your `openclaw.json`:

```json
{
  "mcpServers": {
    "microsoft-graph": {
      "command": "node",
      "args": ["./mcp-servers/microsoft-graph/src/index.mjs"],
      "env": {
        "MS_CLIENT_ID": "${MS_CLIENT_ID}",
        "MS_CLIENT_SECRET": "${MS_CLIENT_SECRET}",
        "MS_TENANT_ID": "${MS_TENANT_ID}",
        "MS_DEFAULT_USER": "${MS_DEFAULT_USER}"
      }
    }
  }
}
```

Make sure those vars are loaded into the OpenClaw process's environment (e.g., from `.tagai-env`) before launch.

## Notes / limitations

- Token cache is in-process (single-process). It refreshes when within 5 minutes of expiry.
- Errors from Graph are returned as structured MCP errors (`isError: true`), never thrown out of the JSON-RPC channel.
- No retry-with-backoff yet. If Graph throttles (429) the tool call returns the error to the agent, which can decide what to do.
- `drive_get_file` returns metadata + downloadUrl. Use that URL with a normal HTTP client to fetch bytes — keeping byte transfer out of MCP keeps responses small.
