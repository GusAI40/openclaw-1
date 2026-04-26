#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';

const ENV_FILE = '/home/tagai/.tagai-env';
const PORT = 18792;
const HOST_LOG = '/var/log/jarvis-vapi/transcripts.jsonl';
const OPENCLAW_LOG = '/home/tagai/.openclaw/jarvis-vapi/transcripts.jsonl';
const MAYA_LOG = '/var/log/jarvis-vapi/maya-transcripts.jsonl';
const ERR_LOG = '/var/log/jarvis-vapi/webhook-errors.log';
const MAYA_ID = '701efa30-304b-4ddd-b6ec-a4818770389d';

mkdirSync('/var/log/jarvis-vapi', { recursive: true });
mkdirSync('/home/tagai/.openclaw/jarvis-vapi', { recursive: true });

function loadEnv() {
  const t = readFileSync(ENV_FILE, 'utf8'); const e = {};
  for (const l of t.split('\n')) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return e;
}
const env = loadEnv();
const SECRET = env.VAPI_WEBHOOK_SECRET;
const SB_URL = env.SUPABASE_URL, SB_KEY = env.SUPABASE_KEY;
const TG_BOT = env.MICHELLE_MAYA_BOT_TOKEN, TG_CHAT = env.MICHELLE_TELEGRAM_CHAT_ID;
const SR_KEY = env.SIMPLYRETS_API_KEY, SR_SECRET = env.SIMPLYRETS_API_SECRET;
if (!SECRET) { console.error('VAPI_WEBHOOK_SECRET missing'); process.exit(1); }

function logE(m) { try { appendFileSync(ERR_LOG, '[' + new Date().toISOString() + '] ' + m + '\n'); } catch {} }
function vh(b, s) {
  if (!s) return false;
  const e = createHmac('sha256', SECRET).update(b).digest('hex');
  const p = s.replace(/^sha256=/, '').trim();
  if (e.length !== p.length) return false;
  try { return timingSafeEqual(Buffer.from(e, 'hex'), Buffer.from(p, 'hex')); } catch { return false; }
}

async function notifyMichelle(args) {
  const name = args.caller_name || 'Unknown';
  const phone = args.caller_phone || 'no number provided';
  const reason = args.reason || 'wants to speak with Michelle';
  const property_ = args.property || '';
  const lines = [
    'URGENT: Caller wants Michelle direct',
    '',
    'From: ' + name + ' (' + phone + ')'
  ];
  if (property_) lines.push('About: ' + property_);
  lines.push('Reason: ' + reason);
  lines.push('');
  lines.push('Live alert via @michelle_maya_bot, call may still be in progress.');
  await tgAlert(lines.join('\n'));
  return { success: true, message: 'Michelle has been notified and will reach out shortly.' };
}

async function lookupListing(query) {
  if (!SR_KEY || !SR_SECRET) return { error: 'SimplyRETS creds missing' };
  if (!query || typeof query !== 'string') return { error: 'Empty query' };
  const auth = 'Basic ' + Buffer.from(SR_KEY + ':' + SR_SECRET).toString('base64');

  // Normalize: strip state suffixes (Texas, TX, TX,) and trailing commas/punct
  const normalize = s => s
    .replace(/,?\s*(texas|tx)\.?$/i, '')
    .replace(/[,.\s]+$/, '')
    .trim();
  const normalized = normalize(query);

  // Build query attempts: original, normalized free-text, then city filter on the last word
  const lastWord = normalized.split(/\s+/).slice(-1)[0];
  const isLikelyCity = /^[A-Za-z][A-Za-z\s]*$/.test(normalized) && normalized.split(/\s+/).length <= 3;
  const attempts = [];
  attempts.push('q=' + encodeURIComponent(query));
  if (normalized !== query) attempts.push('q=' + encodeURIComponent(normalized));
  if (isLikelyCity) attempts.push('cities=' + encodeURIComponent(normalized));

  let data = [];
  let lastUrl = '';
  try {
    for (const params of attempts) {
      lastUrl = 'https://api.simplyrets.com/properties?' + params + '&limit=3';
      const r = await fetch(lastUrl, { headers: { Authorization: auth } });
      if (!r.ok) return { error: 'SimplyRETS HTTP ' + r.status };
      data = await r.json();
      if (Array.isArray(data) && data.length > 0) break;
    }
    if (!Array.isArray(data) || data.length === 0) return { found: false, message: 'No matching listings found for "' + query + '". Try a more specific address.' };
    const props = data.slice(0, 3).map(p => ({
      mls: p.mlsId,
      address: p.address && p.address.full ? p.address.full : ((p.address && p.address.streetNumber ? p.address.streetNumber + ' ' : '') + (p.address && p.address.streetName ? p.address.streetName : '')),
      city: p.address && p.address.city,
      state: p.address && p.address.state,
      price: p.listPrice,
      beds: p.property && p.property.bedrooms,
      baths: p.property && p.property.bathsFull,
      sqft: p.property && p.property.area,
      yearBuilt: p.property && p.property.yearBuilt,
      status: p.mls && p.mls.status,
      type: p.property && p.property.type,
      listed: p.listDate,
      photoCount: (p.photos || []).length
    }));
    return { found: true, count: props.length, properties: props };
  } catch (e) { logE('SR fetch fail: ' + e.message); return { error: e.message }; }
}

async function sbInsert(rec) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(SB_URL + '/rest/v1/michelle_voice_leads', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(rec)
    });
    if (!r.ok) { logE('SB ' + r.status + ': ' + await r.text()); return null; }
    return await r.json();
  } catch (e) { logE('SB ex: ' + e.message); return null; }
}

async function tgAlert(text) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG_BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' })
    });
    if (!r.ok) logE('TG ' + r.status + ': ' + await r.text());
  } catch (e) { logE('TG ex: ' + e.message); }
}

const server = createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
  const url = req.url || '';
  if (url !== '/vapi/webhook' && url !== '/vapi/tool') { res.writeHead(404); return res.end(); }
  const chunks = []; req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const raw = Buffer.concat(chunks);
    const sig = req.headers['x-vapi-signature'] || req.headers['x-vapi-secret'] || req.headers['x-vapi-signature-256'] || '';
    if (!vh(raw, sig)) { logE('HMAC fail ' + url + ' ip=' + req.socket.remoteAddress); res.writeHead(401); return res.end('unauthorized'); }
    let p; try { p = JSON.parse(raw.toString('utf8')); } catch (e) { logE('bad json: ' + e.message); res.writeHead(400); return res.end('bad json'); }
    const msg = p.message || p;

    if (msg.type === 'tool-calls' || msg.type === 'function-call') {
      const calls = msg.toolCallList || msg.toolCalls || (msg.functionCall ? [msg.functionCall] : []);
      const results = [];
      for (const c of calls) {
        const id = c.id || c.toolCallId;
        const fname = (c.function && c.function.name) || c.name;
        let args = (c.function && c.function.arguments) || c.arguments || {};
        if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
        let result;
        if (fname === 'lookup_listing') {
          result = await lookupListing(args.query || args.address || '');
        } else if (fname === 'notify_michelle') {
          result = await notifyMichelle(args);
        } else {
          result = { error: 'Unknown tool: ' + fname };
        }
        results.push({ toolCallId: id, result: JSON.stringify(result) });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ results }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');

    if (msg.type !== 'end-of-call-report') return;
    const callId = (msg.call && msg.call.id) || 'unknown';
    const aId = (msg.call && msg.call.assistantId) || (msg.assistant && msg.assistant.id) || '';
    const phone = (msg.call && msg.call.customer && msg.call.customer.number) || (msg.customer && msg.customer.number) || '';
    const name = (msg.call && msg.call.customer && msg.call.customer.name) || (msg.customer && msg.customer.name) || '';
    const dur = msg.call && msg.call.endedAt && msg.call.startedAt ? Math.round((new Date(msg.call.endedAt) - new Date(msg.call.startedAt)) / 1000) : 0;
    const sum = msg.summary || (msg.analysis && msg.analysis.summary) || '(no summary)';
    const tx = msg.transcript || (msg.artifact && msg.artifact.transcript) || '';
    const er = msg.endedReason || 'unknown';
    const cost = msg.cost || 0;
    const base = { callId, aId, phone, name, dur, er, cost, sum, tx, at: new Date().toISOString() };
    try { appendFileSync(HOST_LOG, JSON.stringify(base) + '\n'); } catch {}

    if (aId === MAYA_ID) {
      await sbInsert({ call_id: callId, assistant_id: aId, caller_phone: phone, caller_name: name || null, duration_seconds: dur, end_reason: er, cost, summary: sum, transcript: tx, status: 'new' });
      try { appendFileSync(MAYA_LOG, JSON.stringify(base) + '\n'); } catch {}
      const min = Math.round(dur / 60 * 10) / 10;
      await tgAlert('*New voice lead for Michelle*\n\n*From:* ' + (name || 'Unknown') + ' (' + phone + ')\n*Duration:* ' + min + ' min\n*Cost:* $' + cost + '\n*End reason:* ' + er + '\n\n*Summary:*\n' + sum + '\n\n_Saved to Supabase: michelle_voice_leads_');
    } else {
      try { appendFileSync(OPENCLAW_LOG, JSON.stringify(base) + '\n'); } catch {}
    }
  });
});
server.listen(PORT, '127.0.0.1', () => console.log('VAPI webhook+tool listening on 127.0.0.1:' + PORT));
