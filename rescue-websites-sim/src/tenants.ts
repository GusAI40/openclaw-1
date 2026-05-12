// Tenant configurations. Two seed tenants (gus, julian) with
// territories chosen to GUARANTEE friendly-fire under --lock=none.
//
// Both tenants target the 76226 Argyle TX area for dentistry +
// construction (the two verticals with built mockup templates).
// Julian additionally targets 76034 chiropractors (a vertical
// without templates — surfaces the 4th blindspot for Julian only).
// Gus additionally targets 76092 legal (also templateless).
//
// from_domain is intentionally THE SAME for both tenants — that's
// the reputation-burn surface. When tenants diverge to separate
// sender domains, the simulator should be re-run to see whether
// the burn risk goes away.

import type { Vertical } from './distributions.ts';

export interface Territory {
  zip: string;
  vertical: Vertical;
  // How many businesses this territory yields per discovery batch.
  // Real Google Places returns up to ~60 per radius search; we use
  // smaller numbers to keep the sim's lead-pool diverse.
  yieldPerBatch: number;
}

export interface TenantConfig {
  id: string;
  fromDomain: string;
  fromAddress: string;        // e.g. "Julian Sanchez <julian@ubntag.com>"
  // Daily send cap (Resend free = 100, $20 tier = ~1666).
  // We use a CONSERVATIVE warm-up curve: cap ramps over time.
  sendCapWarmup: (dayIndex: number) => number;
  // How often this tenant runs a discovery batch (in simulated days).
  discoverEveryDays: number;
  territories: Territory[];
}

// Warm-up curve: 25/day week 1, 50/day week 2, 100/day weeks 3-4,
// then 200/day. Mirrors what a sane email-deliverability consultant
// would prescribe for a fresh sender on a shared domain.
function defaultWarmup(dayIndex: number): number {
  if (dayIndex < 7)  return 25;
  if (dayIndex < 14) return 50;
  if (dayIndex < 28) return 100;
  return 200;
}

export const TENANTS: Record<string, TenantConfig> = {
  gus: {
    id: 'gus',
    fromDomain: 'ubntag.com',
    fromAddress: 'Gus Sanchez <gus@ubntag.com>',
    sendCapWarmup: defaultWarmup,
    discoverEveryDays: 2,
    territories: [
      { zip: '76226', vertical: 'dentistry',    yieldPerBatch: 8 },  // OVERLAPS Julian
      { zip: '76226', vertical: 'construction', yieldPerBatch: 6 },  // OVERLAPS Julian
      { zip: '76092', vertical: 'legal',        yieldPerBatch: 5 },  // gus-only, no templates
    ],
  },
  julian: {
    id: 'julian',
    fromDomain: 'ubntag.com',  // SAME domain as gus → reputation-burn surface
    fromAddress: 'Julian Sanchez <julian@ubntag.com>',
    sendCapWarmup: defaultWarmup,
    discoverEveryDays: 2,
    territories: [
      { zip: '76226', vertical: 'dentistry',    yieldPerBatch: 8 },  // OVERLAPS Gus
      { zip: '76226', vertical: 'construction', yieldPerBatch: 6 },  // OVERLAPS Gus
      { zip: '76034', vertical: 'roofing',      yieldPerBatch: 5 },  // julian-only, no templates
      { zip: '76034', vertical: 'hvac',         yieldPerBatch: 5 },  // julian-only, no templates
    ],
  },
};

export function tenantById(id: string): TenantConfig {
  const t = TENANTS[id];
  if (!t) throw new Error(`Unknown tenant: ${id}`);
  return t;
}
