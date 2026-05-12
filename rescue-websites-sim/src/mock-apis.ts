// Mocked external APIs: Google Places, Firecrawl/PageSpeed,
// Cloudflare Pages, Resend.
//
// The CRITICAL property of mockGooglePlacesDiscover is that the
// returned business list is a deterministic function of (zip,
// vertical) — NOT of the calling tenant. That's how friendly fire
// happens in reality: Google returns the same businesses to whoever
// queries, and our pipeline races to claim them.

import { Rng, VERTICALS, rollScore, type Vertical } from './distributions.ts';

export interface SimBusiness {
  id: string;              // synthetic but stable "ChIJ..." id
  name: string;
  slug: string;
  zip: string;
  vertical: Vertical;
  // contact_email is determined at audit-time (not at discovery),
  // mirroring the real pipeline (Firecrawl extracts emails).
  // We pre-compute it here so it's stable per business across runs.
  potential_email: string | null;
}

// FNV-1a 32-bit string hash → seed for sub-RNG. Deterministic.
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Returns the FULL theoretical lead pool for (zip, vertical). The
// caller's `count` parameter just slices the first N — both tenants
// querying the same territory see the same prefix and collide.
//
// Pool size is intentionally bounded (~2x typical batch size) so
// over a 90-day sim, both tenants exhaust the same finite set of
// shared leads, surfacing collision rates honestly.
function leadPool(zip: string, vertical: Vertical): SimBusiness[] {
  const rng = new Rng(hashSeed(`pool:${zip}:${vertical}`));
  // Pool size tuned so that a 1000-interaction run with 2 tenants can
  // exhaust ~half the pool — leaves enough slack for collisions to be
  // measurable but small enough that exhaustion-driven snooze recycling
  // matters within 90 days.
  const poolSize = 200;
  const FIRST_NAMES  = ['Bright', 'Family', 'Premier', 'Modern', 'Elite', 'Sunrise', 'Oak', 'Lakeside', 'Argyle', 'Summit', 'Crown', 'Liberty', 'Central', 'Westside', 'Northgate', 'Riverside', 'Hilltop', 'Valley', 'Pioneer', 'Heritage'];
  const SUFFIXES: Record<Vertical, string[]> = {
    dentistry:    ['Dental', 'Smiles', 'Dentistry', 'Orthodontics', 'Family Dental'],
    construction: ['Construction', 'Builders', 'Contractors', 'Homes', 'Remodeling'],
    roofing:      ['Roofing', 'Roofers', 'Roof Co', 'Roofing & Restoration'],
    hvac:         ['HVAC', 'Heating & Air', 'Climate Control', 'Mechanical'],
    legal:        ['Law Firm', 'Legal Group', 'Attorneys', '& Associates'],
    medspa:       ['Med Spa', 'Aesthetics', 'Wellness', 'Skin Clinic'],
  };
  const out: SimBusiness[] = [];
  for (let i = 0; i < poolSize; i++) {
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(SUFFIXES[vertical])} #${i + 1}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Place IDs are deterministic per (zip, vertical, index) so two
    // tenants hitting the same query collide on these exact strings.
    const id = `ChIJsim_${zip}_${vertical}_${String(i).padStart(3, '0')}`;
    // ~70% of businesses have findable contact emails on their site.
    // The actual rate varies by vertical and is rolled at audit-time;
    // here we just pre-determine which businesses CAN have one found.
    const hasEmail = rng.next() < 0.85;
    const potential_email = hasEmail
      ? `info@${slug.replace(/-/g, '')}.com`
      : null;
    out.push({ id, name, slug, zip, vertical, potential_email });
  }
  return out;
}

export function mockGooglePlacesDiscover(
  zip: string,
  vertical: Vertical,
  count: number,
  offset: number = 0,
): SimBusiness[] {
  return leadPool(zip, vertical).slice(offset, offset + count);
}

// Pool size accessor so the simulator can detect exhaustion.
export function mockPoolSize(zip: string, vertical: Vertical): number {
  return leadPool(zip, vertical).length;
}

// Audit step. Score is rolled per-call (so re-auditing yields a
// fresh score, mirroring real PageSpeed variability), but the
// email-found check uses the pool's pre-determined potential_email
// gated by the vertical's emailFoundRate.
export interface AuditResult {
  score: number;
  contactEmail: string | null;
}

export function mockAudit(rng: Rng, biz: SimBusiness): AuditResult {
  const profile = VERTICALS[biz.vertical];
  const score = rollScore(rng, profile);
  const contactEmail = biz.potential_email && rng.bernoulli(profile.emailFoundRate)
    ? biz.potential_email
    : null;
  return { score, contactEmail };
}

export interface MockupResult {
  ok: boolean;
  reason?: 'no_template';
  templateCount?: number;
}

export function mockMockupGenerate(biz: SimBusiness): MockupResult {
  const profile = VERTICALS[biz.vertical];
  if (!profile.hasTemplates) {
    return { ok: false, reason: 'no_template' };
  }
  return { ok: true, templateCount: 3 };
}

export function mockCloudflareDeploy(rng: Rng): { ok: boolean } {
  return { ok: rng.bernoulli(0.95) };
}

export type EmailOutcome =
  | 'delivered'    // landed in inbox, no further signal yet
  | 'bounced'      // hard bounce
  | 'complaint'    // marked spam
  | 'unsub'        // explicit unsubscribe
  | 'snooze'       // soft reply: "follow up later"
  | 'reply'        // engaged reply (positive signal)
  | 'no_response'; // synonym for delivered, kept for outcome clarity

export interface EmailDice {
  outcome: EmailOutcome;
  snoozeDays?: number; // populated only when outcome=snooze
}

export function mockEmailSend(rng: Rng, vertical: Vertical): EmailDice {
  const v = VERTICALS[vertical];
  const r = rng.next();
  // Order matters — mutually exclusive cumulative distribution.
  // bounce > complaint > unsub > reply > snooze > delivered (default)
  let cum = 0;
  cum += v.bounceRate;     if (r < cum) return { outcome: 'bounced' };
  cum += v.complaintRate;  if (r < cum) return { outcome: 'complaint' };
  cum += v.hardStopRate;   if (r < cum) return { outcome: 'unsub' };
  cum += v.replyRate;      if (r < cum) return { outcome: 'reply' };
  cum += v.snoozeRate;
  if (r < cum) {
    return { outcome: 'snooze', snoozeDays: rng.intBetween(7, 60) };
  }
  return { outcome: 'delivered' };
}
