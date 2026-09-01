// Read events.jsonl, compute the metrics that matter for the
// three blindspots, plus the "where did time get spent" funnel
// that informs the CRM design.

import { readFileSync } from 'node:fs';
import type { Event, Action } from './ledger.ts';
import type { LockStrategy } from './pipeline-mock.ts';

export interface AnalyzerSummary {
  lock: LockStrategy;
  headline: string;
  totalEvents: number;
  uniquePlaceIds: number;

  // Friendly Fire (blindspot #1)
  // collisions = place_ids ACTUALLY CLAIMED (discover_won) by >1 tenant.
  //   This is the true friendly-fire signal. Under lock=none it's
  //   non-zero; under lock=advisory|race it should be 0.
  // discoveryContention = place_ids ATTEMPTED by >1 tenant.
  //   Informational — normal under overlap territories regardless of lock.
  collisions: number;
  discoveryContention: number;
  doubleSendsToSameEmail: number;
  collisionsByZipVertical: Record<string, number>;

  // Unsubscribe / Snooze (blindspot #2)
  hardSuppressions: number;          // unsub + bounce + complaint events
  snoozesEntered: number;
  snoozesWoken: number;
  emailsSkippedSuppressed: number;
  // BUG signal: same email got sent again AFTER unsub elsewhere?
  // We cannot get this with global suppression because suppression
  // is added at the moment of unsub. But we CAN check: is there a
  // (tenant, to_email) combo that received a send AFTER another
  // tenant logged a hard stop for that email?
  postSuppressionLeaks: number;

  // Reputation Burn (blindspot #3)
  totalSends: number;
  totalBounces: number;
  totalComplaints: number;
  bounceRate: number;
  complaintRate: number;
  emailsSkippedQuota: number;
  peakDailySendsByDomain: Record<string, { day: number; sends: number; cap: number }>;
  daysExceededCap: number;

  // 4th blindspot — vertical not supported
  mockupNoTemplateEvents: number;
  noTemplateByVertical: Record<string, number>;

  // Funnel (per-tenant)
  funnelByTenant: Record<string, FunnelStats>;

  // Email outcome distribution
  emailOutcomes: Record<string, number>;

  // CRM spec: every (action × prev_state → new_state) tuple observed.
  observedTransitions: string[];
}

export interface FunnelStats {
  discoverWon: number;
  discoverLost: number;
  auditNoEmail: number;
  mockupNoTemplate: number;
  deployFailed: number;
  reachedEmail: number;
  replied: number;
  unsubbed: number;
  bounced: number;
  exhausted: number;
}

export function analyze(eventsPath: string, lock: LockStrategy): AnalyzerSummary {
  const lines = readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean);
  const events: Event[] = lines.map(l => JSON.parse(l));

  // Aggregations
  const placeIds = new Set<string>();
  const placeToTenantsAttempted = new Map<string, Set<string>>(); // any event
  const placeToTenantsClaimed = new Map<string, Set<string>>();   // discover_won only
  const placeToEmails = new Map<string, Set<string>>();    // place → emails sent to
  const emailToTenants = new Map<string, Set<string>>();   // email → tenants that sent
  const collisionsByZipVertical: Record<string, number> = {};
  const noTemplateByVertical: Record<string, number> = {};
  const emailOutcomes: Record<string, number> = {};
  const peakDailySendsByDomain: Record<string, { day: number; sends: number; cap: number }> = {};
  const dailyDomainSends: Record<string, Record<number, number>> = {}; // domain → day → sends
  const observedTransitions = new Set<string>();
  const funnelByTenant: Record<string, FunnelStats> = {};

  // Suppression timeline so we can detect post-suppression leaks
  const suppressedAtByEmail = new Map<string, { tenant: string; day: number }>();
  let postSuppressionLeaks = 0;

  let totalSends = 0;
  let totalBounces = 0;
  let totalComplaints = 0;
  let snoozesEntered = 0;
  let snoozesWoken = 0;
  let emailsSkippedSuppressed = 0;
  let emailsSkippedQuota = 0;
  let mockupNoTemplateEvents = 0;
  let hardSuppressions = 0;
  let daysExceededCap = 0;
  const seenCapExceededOnDay = new Set<string>(); // domain|day

  function ensureFunnel(tenant: string): FunnelStats {
    if (!funnelByTenant[tenant]) {
      funnelByTenant[tenant] = {
        discoverWon: 0, discoverLost: 0, auditNoEmail: 0,
        mockupNoTemplate: 0, deployFailed: 0, reachedEmail: 0,
        replied: 0, unsubbed: 0, bounced: 0, exhausted: 0,
      };
    }
    return funnelByTenant[tenant]!;
  }

  for (const e of events) {
    placeIds.add(e.business_id);
    if (!placeToTenantsAttempted.has(e.business_id)) placeToTenantsAttempted.set(e.business_id, new Set());
    placeToTenantsAttempted.get(e.business_id)!.add(e.tenant_id);
    if (e.action === 'discover_won') {
      if (!placeToTenantsClaimed.has(e.business_id)) placeToTenantsClaimed.set(e.business_id, new Set());
      placeToTenantsClaimed.get(e.business_id)!.add(e.tenant_id);
    }

    if (e.prev_state || e.new_state) {
      observedTransitions.add(`${e.action} :: ${e.prev_state ?? '∅'} → ${e.new_state ?? '∅'}`);
    }

    const f = ensureFunnel(e.tenant_id);
    const action: Action = e.action;
    const detailEmail = (e.details as any)?.to_email as string | undefined;
    const detailDomain = (e.details as any)?.from_domain as string | undefined;

    switch (action) {
      case 'discover_won':       f.discoverWon += 1; break;
      case 'discover_lost':      f.discoverLost += 1; break;
      case 'audit_no_email':     f.auditNoEmail += 1; break;
      case 'mockup_no_template':
        f.mockupNoTemplate += 1;
        mockupNoTemplateEvents += 1;
        if (e.vertical) noTemplateByVertical[e.vertical] = (noTemplateByVertical[e.vertical] ?? 0) + 1;
        break;
      case 'deploy_failure':     f.deployFailed += 1; break;
      case 'email_send':
        f.reachedEmail += 1;
        totalSends += 1;
        emailOutcomes['delivered'] = (emailOutcomes['delivered'] ?? 0) + 1;
        if (detailEmail) {
          if (!placeToEmails.has(e.business_id)) placeToEmails.set(e.business_id, new Set());
          placeToEmails.get(e.business_id)!.add(detailEmail);
          if (!emailToTenants.has(detailEmail)) emailToTenants.set(detailEmail, new Set());
          emailToTenants.get(detailEmail)!.add(e.tenant_id);
          // Post-suppression leak check
          const sup = suppressedAtByEmail.get(detailEmail);
          if (sup && sup.day < e.sim_day && sup.tenant !== e.tenant_id) {
            postSuppressionLeaks += 1;
          }
        }
        if (detailDomain) {
          dailyDomainSends[detailDomain] ??= {};
          dailyDomainSends[detailDomain]![e.sim_day] = (dailyDomainSends[detailDomain]![e.sim_day] ?? 0) + 1;
        }
        break;
      case 'email_reply':        f.replied += 1; emailOutcomes['reply'] = (emailOutcomes['reply'] ?? 0) + 1; break;
      case 'email_unsub':
        f.unsubbed += 1;
        hardSuppressions += 1;
        emailOutcomes['unsub'] = (emailOutcomes['unsub'] ?? 0) + 1;
        if (detailEmail) suppressedAtByEmail.set(detailEmail, { tenant: e.tenant_id, day: e.sim_day });
        break;
      case 'email_bounce':
        f.bounced += 1;
        totalBounces += 1;
        hardSuppressions += 1;
        emailOutcomes['bounced'] = (emailOutcomes['bounced'] ?? 0) + 1;
        if (detailEmail) suppressedAtByEmail.set(detailEmail, { tenant: e.tenant_id, day: e.sim_day });
        break;
      case 'email_complaint':
        totalComplaints += 1;
        hardSuppressions += 1;
        emailOutcomes['complaint'] = (emailOutcomes['complaint'] ?? 0) + 1;
        if (detailEmail) suppressedAtByEmail.set(detailEmail, { tenant: e.tenant_id, day: e.sim_day });
        break;
      case 'email_snooze':       snoozesEntered += 1; emailOutcomes['snooze'] = (emailOutcomes['snooze'] ?? 0) + 1; break;
      case 'snooze_woken':       snoozesWoken += 1; break;
      case 'email_skipped_suppressed': emailsSkippedSuppressed += 1; break;
      case 'email_skipped_quota':
        emailsSkippedQuota += 1;
        if (detailDomain) {
          const k = `${detailDomain}|${e.sim_day}`;
          if (!seenCapExceededOnDay.has(k)) {
            seenCapExceededOnDay.add(k);
            daysExceededCap += 1;
          }
          const cap = (e.details as any)?.cap as number | undefined;
          const sends = (e.details as any)?.sends_today as number | undefined;
          if (cap != null && sends != null) {
            const cur = peakDailySendsByDomain[detailDomain];
            if (!cur || sends > cur.sends) {
              peakDailySendsByDomain[detailDomain] = { day: e.sim_day, sends, cap };
            }
          }
        }
        break;
      case 'sequence_exhausted': f.exhausted += 1; break;
      // Other actions: discover_attempt, audit, mockup_generated, deploy_success, discover_collision, tenant_day_summary
      default: break;
    }

    // Track collision events
    if (action === 'discover_collision' && e.zip && e.vertical) {
      const k = `${e.zip}|${e.vertical}`;
      collisionsByZipVertical[k] = (collisionsByZipVertical[k] ?? 0) + 1;
    }
  }

  // Compute peak from dailyDomainSends if no quota events fired
  // (i.e., cap was never exceeded — peak comes from the running max)
  for (const [domain, byDay] of Object.entries(dailyDomainSends)) {
    let maxDay = -1;
    let maxSends = -1;
    for (const [day, sends] of Object.entries(byDay)) {
      if (sends > maxSends) {
        maxSends = sends;
        maxDay = parseInt(day, 10);
      }
    }
    if (!peakDailySendsByDomain[domain] && maxSends >= 0) {
      peakDailySendsByDomain[domain] = { day: maxDay, sends: maxSends, cap: -1 };
    }
  }

  const collisions = [...placeToTenantsClaimed.values()].filter(s => s.size > 1).length;
  const discoveryContention = [...placeToTenantsAttempted.values()].filter(s => s.size > 1).length;
  const doubleSendsToSameEmail = [...emailToTenants.values()].filter(s => s.size > 1).length;
  const bounceRate = totalSends > 0 ? totalBounces / totalSends : 0;
  const complaintRate = totalSends > 0 ? totalComplaints / totalSends : 0;

  const headline = lock === 'none'
    ? `lock=none → ${collisions} places double-claimed, ${doubleSendsToSameEmail} emails double-targeted, ${discoveryContention} attempts contended, ${postSuppressionLeaks} post-suppression leaks`
    : `lock=${lock} → ${collisions} places double-claimed (target: 0), ${doubleSendsToSameEmail} double-targeted emails (target: 0), ${discoveryContention} contentions correctly resolved`;

  return {
    lock,
    headline,
    totalEvents: events.length,
    uniquePlaceIds: placeIds.size,
    collisions,
    discoveryContention,
    doubleSendsToSameEmail,
    collisionsByZipVertical,
    hardSuppressions,
    snoozesEntered,
    snoozesWoken,
    emailsSkippedSuppressed,
    postSuppressionLeaks,
    totalSends,
    totalBounces,
    totalComplaints,
    bounceRate,
    complaintRate,
    emailsSkippedQuota,
    peakDailySendsByDomain,
    daysExceededCap,
    mockupNoTemplateEvents,
    noTemplateByVertical,
    funnelByTenant,
    emailOutcomes,
    observedTransitions: [...observedTransitions].sort(),
  };
}
