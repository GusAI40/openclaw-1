#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
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

async function tgAlert(text) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG_BOT + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' })
    });
    if (!r.ok) logE('TG ' + r.status + ': ' + await r.text());
  } catch (e) { logE('TG ex: ' + e.message); }
}

async function tgAlertWithKeyboard(text, keyboard) {
  if (!TG_BOT || !TG_CHAT) { logE('TG creds missing'); return null; }
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG_BOT + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } })
    });
    const j = await r.json();
    if (!j.ok) { logE('tg keyboard fail: ' + JSON.stringify(j)); return null; }
    return { chatId: String(j.result.chat.id), messageId: j.result.message_id };
  } catch (e) { logE('tgKeyboard ex: ' + e.message); return null; }
}

async function sbInsertTo(table, rec) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(rec)
    });
    if (!r.ok) { logE('SB ' + table + ' ' + r.status + ': ' + await r.text()); return null; }
    return await r.json();
  } catch (e) { logE('SB ' + table + ' ex: ' + e.message); return null; }
}

async function sbInsert(rec) { return sbInsertTo('michelle_voice_leads', rec); }

async function notifyMichelle(args) {
  const name = args.caller_name || 'Unknown';
  const phone = args.caller_phone || 'no number provided';
  const reason = args.reason || 'wants to speak with Michelle';
  const property_ = args.property || '';
  const lines = ['URGENT: Caller wants Michelle direct', '', 'From: ' + name + ' (' + phone + ')'];
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
  const normalize = s => s.replace(/,?\s*(texas|tx)\.?$/i, '').replace(/[,.\s]+$/, '').trim();
  const normalized = normalize(query);
  const isLikelyCity = /^[A-Za-z][A-Za-z\s]*$/.test(normalized) && normalized.split(/\s+/).length <= 3;
  const attempts = [];
  attempts.push('q=' + encodeURIComponent(query));
  if (normalized !== query) attempts.push('q=' + encodeURIComponent(normalized));
  if (isLikelyCity) attempts.push('cities=' + encodeURIComponent(normalized));
  let data = [];
  try {
    for (const params of attempts) {
      const url = 'https://api.simplyrets.com/properties?' + params + '&limit=3';
      const r = await fetch(url, { headers: { Authorization: auth } });
      if (!r.ok) return { error: 'SimplyRETS HTTP ' + r.status };
      data = await r.json();
      if (Array.isArray(data) && data.length > 0) break;
    }
    if (!Array.isArray(data) || data.length === 0) return { found: false, message: 'No matching listings found for "' + query + '". Try a more specific address.' };
    const props = data.slice(0, 3).map(p => ({
      mls: p.mlsId,
      address: p.address && p.address.full ? p.address.full : ((p.address && p.address.streetNumber ? p.address.streetNumber + ' ' : '') + (p.address && p.address.streetName ? p.address.streetName : '')),
      city: p.address && p.address.city, state: p.address && p.address.state,
      price: p.listPrice, beds: p.property && p.property.bedrooms, baths: p.property && p.property.bathsFull,
      sqft: p.property && p.property.area, yearBuilt: p.property && p.property.yearBuilt,
      status: p.mls && p.mls.status, type: p.property && p.property.type,
      listed: p.listDate, photoCount: (p.photos || []).length
    }));
    return { found: true, count: props.length, properties: props };
  } catch (e) { logE('SR fetch fail: ' + e.message); return { error: e.message }; }
}

async function compAnalysis(args) {
  if (!SR_KEY || !SR_SECRET) return { error: 'SimplyRETS creds missing' };
  const area = (args.area || '').trim();
  if (!area) return { error: 'area required (city or postal code)' };
  const auth = 'Basic ' + Buffer.from(SR_KEY + ':' + SR_SECRET).toString('base64');
  const isZip = /^\d{5}$/.test(area);
  const baseParams = new URLSearchParams();
  if (isZip) baseParams.set('postalCodes', area); else baseParams.set('cities', area);
  if (args.beds) baseParams.set('minBeds', String(args.beds));
  if (args.baths_min) baseParams.set('minBaths', String(args.baths_min));
  if (args.sqft_min) baseParams.set('minArea', String(args.sqft_min));
  if (args.sqft_max) baseParams.set('maxArea', String(args.sqft_max));
  if (args.year_built_min) baseParams.set('minYear', String(args.year_built_min));
  baseParams.set('limit', '50');
  const median = nums => { if (!nums.length) return null; const s = [...nums].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : Math.round((s[m-1]+s[m])/2); };
  const avg = nums => nums.length ? Math.round(nums.reduce((a,b)=>a+b,0)/nums.length) : null;
  async function fetchSet(status, extra={}) {
    const p = new URLSearchParams(baseParams); p.set('status', status);
    for (const [k,v] of Object.entries(extra)) p.set(k,v);
    const url = 'https://api.simplyrets.com/properties?' + p.toString();
    try {
      const r = await fetch(url, { headers: { Authorization: auth } });
      if (!r.ok) { logE('comp ' + status + ' HTTP ' + r.status); return []; }
      const d = await r.json(); return Array.isArray(d) ? d : [];
    } catch (e) { logE('comp fetch fail: ' + e.message); return []; }
  }
  const oneYearAgo = new Date(Date.now() - 365*86400000).toISOString().split('T')[0];
  const [active, closed] = await Promise.all([fetchSet('Active'), fetchSet('Closed', { minClosedDate: oneYearAgo })]);
  function summarize(list, priceField) {
    const prices = list.map(p=>p[priceField]).filter(n=>typeof n==='number'&&n>0);
    const sqfts = list.map(p=>p.property&&p.property.area).filter(n=>typeof n==='number'&&n>0);
    const ppsf = list.map(p=>{ const pr=p[priceField], sf=p.property&&p.property.area; return (typeof pr==='number'&&typeof sf==='number'&&sf>0)?Math.round(pr/sf):null; }).filter(n=>n!==null);
    const dom = list.map(p=>p.mls&&p.mls.daysOnMarket).filter(n=>typeof n==='number');
    return { count: list.length, min_price: prices.length?Math.min(...prices):null, max_price: prices.length?Math.max(...prices):null, avg_price: avg(prices), median_price: median(prices), avg_sqft: avg(sqfts), ppsf_min: ppsf.length?Math.min(...ppsf):null, ppsf_max: ppsf.length?Math.max(...ppsf):null, avg_dom: avg(dom) };
  }
  const recentClosed = closed.filter(p=>p.mls&&p.mls.closeDate).sort((a,b)=>new Date(b.mls.closeDate)-new Date(a.mls.closeDate)).slice(0,3).map(p=>({ address: p.address&&p.address.full, close_price: p.closePrice, sqft: p.property&&p.property.area, beds: p.property&&p.property.bedrooms, baths: p.property&&p.property.bathsFull, close_date: p.mls&&p.mls.closeDate, dom: p.mls&&p.mls.daysOnMarket }));
  const filterDesc = [args.beds?args.beds+'+ bed':null, args.baths_min?args.baths_min+'+ bath':null, (args.sqft_min||args.sqft_max)?((args.sqft_min||'?')+'-'+(args.sqft_max||'?')+' sqft'):null, args.year_built_min?'built '+args.year_built_min+'+':null].filter(Boolean).join(', ') || 'any';
  if (active.length===0 && closed.length===0) return { found: false, area, filters: filterDesc, message: 'No comps found in '+area+' for '+filterDesc+'.' };
  return { found: true, area, filters: filterDesc, active: summarize(active,'listPrice'), closed_12mo: summarize(closed,'closePrice'), recent_closed: recentClosed };
}

function parseRequestedWhen(raw, nowMs = Date.now()) {
  const out = { ts: null, confidence: 'uncertain', display: raw };
  if (!raw || typeof raw !== 'string') return out;
  const s = raw.trim().toLowerCase();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(nowMs)).map(p=>[p.type,p.value]));
  const baseY = +parts.year, baseM = +parts.month, baseD = +parts.day;
  const mkLocal = (y,m,d,hh,mm=0) => new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00-06:00`);
  let dayOffset = null;
  if (/\btoday\b/.test(s)) dayOffset = 0;
  else if (/\btomorrow\b|\btmrw?\b/.test(s)) dayOffset = 1;
  else if (/\bday after tomorrow\b/.test(s)) dayOffset = 2;
  const dows = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dowMatch = dows.findIndex(d => new RegExp(`\\b${d}\\b`).test(s));
  if (dayOffset === null && dowMatch >= 0) {
    const todayDow = new Date(mkLocal(baseY,baseM,baseD,12)).getUTCDay();
    let delta = (dowMatch - todayDow + 7) % 7;
    if (delta === 0) delta = 7;
    if (/\bnext\b/.test(s) && delta < 7) delta += 7;
    dayOffset = delta;
  }
  let hh = null, mm = 0, timeConf = 'uncertain';
  const tm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (tm) {
    hh = +tm[1]; mm = tm[2] ? +tm[2] : 0;
    const ap = tm[3];
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    if (!ap && hh >= 1 && hh <= 7) hh += 12;
    timeConf = ap ? 'exact' : 'approximate';
  } else if (/\bmorning\b/.test(s)) { hh = 10; timeConf = 'approximate'; }
  else if (/\bnoon\b/.test(s)) { hh = 12; timeConf = 'exact'; }
  else if (/\bafternoon\b/.test(s)) { hh = 14; timeConf = 'approximate'; }
  else if (/\bevening\b/.test(s)) { hh = 18; timeConf = 'approximate'; }
  if (dayOffset !== null && hh !== null) {
    const target = new Date(mkLocal(baseY,baseM,baseD,12).getTime() + dayOffset*86400000);
    target.setUTCHours(target.getUTCHours() - 12 + hh);
    target.setUTCMinutes(mm);
    out.ts = target.toISOString();
    out.confidence = (dowMatch >= 0 || dayOffset !== null) && timeConf !== 'uncertain' ? (timeConf === 'exact' ? 'exact' : 'approximate') : 'uncertain';
  }
  return out;
}

function idemKey({ caller_phone, property_address, when_ts, when_raw }) {
  const bucket = Math.floor(Date.now() / (5*60*1000));
  const basis = `${(caller_phone||'').replace(/\D/g,'')}|${(property_address||'').toLowerCase().trim()}|${when_ts||when_raw||''}|${bucket}`;
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

function fmtForHumans(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12: true }).format(new Date(iso));
}

async function requestShowing(args, callId) {
  const { property_address, caller_name, caller_phone, requested_date_time, notes, mls_number, listing_id } = args || {};
  if (!property_address || !caller_phone || !requested_date_time) {
    return { success: false, message: 'I need the property address, your phone number, and a day and time to set this up. Could you share those?' };
  }
  const parsed = parseRequestedWhen(requested_date_time);
  const idem = idemKey({ caller_phone, property_address, when_ts: parsed.ts, when_raw: requested_date_time });
  const niceWhen = parsed.ts ? fmtForHumans(parsed.ts) : null;
  const confTag = parsed.confidence === 'exact' ? '🟢 Exact' : parsed.confidence === 'approximate' ? '🟡 Approx' : '🔴 Needs confirm';
  const telegramText = `🏡 <b>NEW SHOWING REQUEST</b>\n\n<b>Property:</b> ${property_address}${mls_number?' (MLS '+mls_number+')':''}\n<b>Caller:</b> ${caller_name||'Unknown'}\n<b>Phone:</b> ${caller_phone}\n\n<b>Requested:</b> ${niceWhen||requested_date_time}\n<b>Heard as:</b> "${requested_date_time}"\n<b>Parse:</b> ${confTag}${notes?'\n\n<b>Notes:</b> '+notes:''}\n<i>Call ${callId||'n/a'}</i>`;
  const kb = [
    [ { text: '✅ Confirm', callback_data: `sr:confirm:${idem}` }, { text: '❌ Decline', callback_data: `sr:decline:${idem}` } ],
    [ { text: '📞 Call buyer', url: `tel:${(caller_phone||'').replace(/[^\d+]/g,'')}` }, { text: '✏️ Pick new time', callback_data: `sr:reschedule:${idem}` } ]
  ];
  const tg = await tgAlertWithKeyboard(telegramText, kb);
  await sbInsertTo('michelle_showing_requests', {
    call_id: callId || null, caller_name: caller_name || null, caller_phone, property_address,
    mls_number: mls_number || null, listing_id: listing_id || null,
    requested_when_raw: requested_date_time, requested_when_ts: parsed.ts, parse_confidence: parsed.confidence,
    notes: notes || null, status: 'pending',
    telegram_chat_id: tg ? tg.chatId : null, telegram_message_id: tg ? tg.messageId : null,
    idem_key: idem
  });
  const spoken = niceWhen ? `Penciled in for ${niceWhen}. Michelle will text you to confirm within 30 minutes.` : `I've got that down as "${requested_date_time}". Michelle will text you within 30 minutes to lock in the exact time.`;
  return { success: true, message: spoken };
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
      const callId = (msg.call && msg.call.id) || null;
      const calls = msg.toolCallList || msg.toolCalls || (msg.functionCall ? [msg.functionCall] : []);
      const results = [];
      for (const c of calls) {
        const id = c.id || c.toolCallId;
        const fname = (c.function && c.function.name) || c.name;
        let args = (c.function && c.function.arguments) || c.arguments || {};
        if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
        let result;
        if (fname === 'lookup_listing') result = await lookupListing(args.query || args.address || '');
        else if (fname === 'notify_michelle') result = await notifyMichelle(args);
        else if (fname === 'request_showing') result = await requestShowing(args, callId);
        else if (fname === 'comp_analysis') result = await compAnalysis(args);
        else result = { error: 'Unknown tool: ' + fname };
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
