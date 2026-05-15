import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '..', '.env');

// Simple .env loader — no external dependency needed
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.warn('No .env file found at', envPath);
}

function req(key: string, val: string | undefined): string {
  if (!val) {
    console.warn(`Missing required env var: ${key}. Set it in .env or export it.`);
    return '';
  }
  return val;
}

function parseIntOr(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  FIRECRAWL_API_KEY: req('FIRECRAWL_API_KEY', process.env.FIRECRAWL_API_KEY),
  GOOGLE_PLACES_API_KEY: req('GOOGLE_PLACES_API_KEY', process.env.GOOGLE_PLACES_API_KEY),
  PAGESPEED_API_KEY: process.env.PAGESPEED_API_KEY || '',
  RESEND_API_KEY: req('RESEND_API_KEY', process.env.RESEND_API_KEY),
  RESEND_FROM: process.env.RESEND_FROM || 'Julian Sanchez <julian@ubntag.com>',
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'julian@ubntag.com',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  REPORT_BASE_URL: process.env.REPORT_BASE_URL || 'https://rescue-websites.pages.dev',
  SUPABASE_URL: req('SUPABASE_URL', process.env.SUPABASE_URL),
  SUPABASE_ANON_KEY: req('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY),
  TENANT_ID: process.env.TENANT_ID || 'gus',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  VOICE_PROXY_URL: process.env.VOICE_PROXY_URL || 'wss://rescue-voice-proxy.jujusanchez413.workers.dev',

  // Reputation-burn guard. Default 1000 = runaway-loop safety floor on
  // an already-warm domain. ubntag.com has years of history and ~5K/day
  // proven capacity, so this is 5x headroom below proven capacity, not
  // a Resend warm-up ceiling. Bump higher in tenant .env if needed.
  DAILY_SEND_CAP: parseIntOr(process.env.DAILY_SEND_CAP, 1000),
};

/**
 * Extract the bare domain from RESEND_FROM.
 * 'Julian Sanchez <julian@ubntag.com>' -> 'ubntag.com'
 * 'julian@ubntag.com'                   -> 'ubntag.com'
 *
 * Used by the send-quota gate to bucket sends per (tenant, domain, day).
 */
export function getFromDomain(): string {
  const raw = env.RESEND_FROM || '';
  const m = raw.match(/@([A-Za-z0-9.\-]+)/);
  return m ? m[1].toLowerCase() : 'unknown';
}
