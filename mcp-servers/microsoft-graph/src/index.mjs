#!/usr/bin/env node
/**
 * @tag/mcp-microsoft-graph
 *
 * Self-contained MCP stdio server that exposes a small, focused subset of
 * Microsoft Graph as agent tools:
 *   - mail_search, mail_send
 *   - calendar_list_events, calendar_create_event
 *   - drive_list, drive_get_file
 *
 * Auth: app-only (client-credentials). Each tool that touches a mailbox or
 * drive REQUIRES a `user` (UPN or Graph user id) argument because the server
 * has no signed-in user identity.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { z } from 'zod';

// ---------- env ----------

const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const DEFAULT_USER = process.env.MS_DEFAULT_USER || null;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '[mcp-microsoft-graph] Missing required env vars: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET',
  );
  process.exit(1);
}

const SCOPE = 'https://graph.microsoft.com/.default';
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh if token expires within 5 min

// ---------- token cache ----------

const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
let cached = { token: null, expiresOnTimestamp: 0 };

async function getAccessToken() {
  const now = Date.now();
  if (cached.token && cached.expiresOnTimestamp - now > REFRESH_SKEW_MS) {
    return cached.token;
  }
  const result = await credential.getToken(SCOPE);
  if (!result || !result.token) {
    throw new Error('Failed to acquire app-only token from Entra ID');
  }
  cached = { token: result.token, expiresOnTimestamp: result.expiresOnTimestamp };
  return cached.token;
}

const graph = Client.init({
  defaultVersion: 'v1.0',
  authProvider: (done) => {
    getAccessToken().then(
      (t) => done(null, t),
      (err) => done(err, null),
    );
  },
});

// ---------- helpers ----------

/**
 * Resolve the mailbox/drive owner for a tool call. If the caller omitted
 * `user` and MS_DEFAULT_USER is set, fall back to that. Otherwise throw a
 * caller-friendly error.
 */
function resolveUser(user) {
  const u = (user || DEFAULT_USER || '').trim();
  if (!u) {
    throw new Error(
      "Missing required argument 'user' (UPN or Graph user id). Set MS_DEFAULT_USER to make it optional.",
    );
  }
  return encodeURIComponent(u);
}

/**
 * Wrap a tool handler so any thrown / Graph error becomes a structured
 * MCP error result instead of crashing the JSON-RPC channel.
 */
function safe(handler) {
  return async (args, extra) => {
    try {
      return await handler(args, extra);
    } catch (err) {
      const code = err?.code || err?.statusCode || 'Error';
      const message = err?.message || String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Graph: ${code}: ${message}` }],
      };
    }
  };
}

function asJson(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------- server ----------

const server = new McpServer(
  { name: 'mcp-microsoft-graph', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ----- mail_search -----
server.registerTool(
  'mail_search',
  {
    title: 'Mail: search messages',
    description:
      "Search a user's mailbox via Microsoft Graph $search. Requires Mail.Read (Application).",
    inputSchema: {
      user: z
        .string()
        .describe("Mailbox UPN or Graph user id (e.g. 'gus@tenant.onmicrosoft.com')"),
      query: z.string().describe('Free-text search query (KQL-style)'),
      top: z.number().int().min(1).max(100).optional().describe('Max results (default 10)'),
    },
  },
  safe(async ({ user, query, top }) => {
    const u = resolveUser(user);
    const n = top ?? 10;
    const res = await graph
      .api(`/users/${u}/messages`)
      .header('ConsistencyLevel', 'eventual')
      .search(`"${query.replace(/"/g, '\\"')}"`)
      .top(n)
      .select('id,from,subject,receivedDateTime,bodyPreview')
      .get();
    const items = (res?.value || []).map((m) => ({
      id: m.id,
      from: m.from?.emailAddress?.address || null,
      subject: m.subject || '',
      receivedDateTime: m.receivedDateTime,
      bodyPreview: m.bodyPreview || '',
    }));
    return asJson(items);
  }),
);

// ----- mail_send -----
server.registerTool(
  'mail_send',
  {
    title: 'Mail: send a message',
    description:
      'Send an email as the specified user. Requires Mail.Send (Application).',
    inputSchema: {
      user: z.string().describe('Sending mailbox UPN or user id'),
      to: z
        .union([z.string(), z.array(z.string())])
        .describe('Recipient address or list of addresses'),
      subject: z.string(),
      body: z.string(),
      contentType: z.enum(['text', 'html']).optional().describe("Default 'text'"),
    },
  },
  safe(async ({ user, to, subject, body, contentType }) => {
    const u = resolveUser(user);
    const recipients = toArray(to).map((addr) => ({
      emailAddress: { address: addr },
    }));
    const message = {
      message: {
        subject,
        body: { contentType: contentType || 'text', content: body },
        toRecipients: recipients,
      },
      saveToSentItems: true,
    };
    await graph.api(`/users/${u}/sendMail`).post(message);
    return asJson({ ok: true });
  }),
);

// ----- calendar_list_events -----
server.registerTool(
  'calendar_list_events',
  {
    title: 'Calendar: list events',
    description:
      "List events on a user's primary calendar. If start+end are provided, " +
      'uses calendarView (range query); otherwise lists upcoming events. ' +
      'Requires Calendars.Read (Application).',
    inputSchema: {
      user: z.string(),
      start: z.string().optional().describe('ISO 8601 start datetime'),
      end: z.string().optional().describe('ISO 8601 end datetime'),
      top: z.number().int().min(1).max(200).optional().describe('Max results (default 25)'),
    },
  },
  safe(async ({ user, start, end, top }) => {
    const u = resolveUser(user);
    const n = top ?? 25;
    const select =
      'id,subject,start,end,attendees,location,organizer,bodyPreview';
    let req;
    if (start && end) {
      req = graph
        .api(`/users/${u}/calendar/calendarView`)
        .query({ startDateTime: start, endDateTime: end })
        .top(n)
        .select(select);
    } else {
      req = graph
        .api(`/users/${u}/calendar/events`)
        .top(n)
        .select(select)
        .orderby('start/dateTime');
    }
    const res = await req.get();
    const items = (res?.value || []).map((e) => ({
      id: e.id,
      subject: e.subject || '',
      start: e.start || null,
      end: e.end || null,
      attendees: (e.attendees || []).map((a) => ({
        name: a.emailAddress?.name || null,
        address: a.emailAddress?.address || null,
        type: a.type || null,
      })),
      location: e.location?.displayName || null,
      organizer: e.organizer?.emailAddress?.address || null,
      bodyPreview: e.bodyPreview || '',
    }));
    return asJson(items);
  }),
);

// ----- calendar_create_event -----
server.registerTool(
  'calendar_create_event',
  {
    title: 'Calendar: create event',
    description:
      "Create an event on a user's primary calendar. " +
      'Requires Calendars.ReadWrite (Application).',
    inputSchema: {
      user: z.string(),
      subject: z.string(),
      start: z.string().describe('ISO 8601 start datetime (UTC)'),
      end: z.string().describe('ISO 8601 end datetime (UTC)'),
      attendees: z.array(z.string()).optional().describe('Attendee email addresses'),
      location: z.string().optional(),
      body: z.string().optional().describe('Event body (text)'),
    },
  },
  safe(async ({ user, subject, start, end, attendees, location, body }) => {
    const u = resolveUser(user);
    const event = {
      subject,
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
    };
    if (location) event.location = { displayName: location };
    if (body) event.body = { contentType: 'text', content: body };
    if (attendees && attendees.length) {
      event.attendees = attendees.map((a) => ({
        emailAddress: { address: a },
        type: 'required',
      }));
    }
    const created = await graph.api(`/users/${u}/calendar/events`).post(event);
    return asJson({ id: created.id, webLink: created.webLink || null });
  }),
);

// ----- drive_list -----
server.registerTool(
  'drive_list',
  {
    title: 'Drive: list items',
    description:
      "List children of a path on a user's OneDrive. " +
      'Requires Files.Read (Application).',
    inputSchema: {
      user: z.string(),
      path: z
        .string()
        .optional()
        .describe("OneDrive path, e.g. '/' or '/Documents/Reports'. Default '/'"),
    },
  },
  safe(async ({ user, path }) => {
    const u = resolveUser(user);
    const p = (path || '/').replace(/^\/+/, '');
    const url = p
      ? `/users/${u}/drive/root:/${encodeURI(p)}:/children`
      : `/users/${u}/drive/root/children`;
    const res = await graph
      .api(url)
      .select('id,name,folder,file,size,lastModifiedDateTime,webUrl')
      .get();
    const items = (res?.value || []).map((it) => ({
      id: it.id,
      name: it.name,
      kind: it.folder ? 'folder' : 'file',
      size: it.size ?? null,
      lastModifiedDateTime: it.lastModifiedDateTime || null,
      webUrl: it.webUrl || null,
    }));
    return asJson(items);
  }),
);

// ----- drive_get_file -----
server.registerTool(
  'drive_get_file',
  {
    title: 'Drive: get file metadata',
    description:
      "Return metadata + a short-lived download URL for a OneDrive item. " +
      'Does NOT download bytes — agent should fetch the URL directly. ' +
      'Requires Files.Read (Application).',
    inputSchema: {
      user: z.string(),
      itemId: z.string().describe('Graph drive item id'),
    },
  },
  safe(async ({ user, itemId }) => {
    const u = resolveUser(user);
    const it = await graph
      .api(`/users/${u}/drive/items/${itemId}`)
      .select('id,name,size,webUrl')
      .get();
    // @microsoft.graph.downloadUrl is only returned when explicitly requested.
    const dl = await graph
      .api(`/users/${u}/drive/items/${itemId}`)
      .select('id,@microsoft.graph.downloadUrl')
      .get();
    return asJson({
      id: it.id,
      name: it.name,
      size: it.size ?? null,
      webUrl: it.webUrl || null,
      downloadUrl: dl?.['@microsoft.graph.downloadUrl'] || null,
    });
  }),
);

// ---------- main ----------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-microsoft-graph] stdio server ready');
}

main().catch((err) => {
  console.error('[mcp-microsoft-graph] fatal:', err);
  process.exit(1);
});
