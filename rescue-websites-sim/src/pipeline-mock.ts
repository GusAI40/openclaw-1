// In-memory pipeline state machine.
//
// Mirrors the schema proposed in migrations/001 (claim semantics,
// suppression list, snooze queue, send quota) but runs entirely
// in-process with deterministic dice. Every state mutation is
// also written to the ledger so the analyzer can replay history.

import { Rng, VERTICALS, type Vertical } from './distributions.ts';
import {
  mockGooglePlacesDiscover,
  mockPoolSize,
  mockAudit,
  mockMockupGenerate,
  mockCloudflareDeploy,
  mockEmailSend,
  type SimBusiness,
} from './mock-apis.ts';
import type { TenantConfig } from './tenants.ts';
import { Ledger, simIso, type Action } from './ledger.ts';

export type LockStrategy = 'none' | 'advisory' | 'race';

export type BusinessStatus =
  | 'discovered'
  | 'audit_no_email'
  | 'mockup_no_template'
  | 'mockup_ready'
  | 'deploy_failed'
  | 'deployed'
  | 'emailing'
  | 'replied'
  | 'snoozed'
  | 'unsubbed'
  | 'bounced'
  | 'complained'
  | 'exhausted';

interface BusinessRow {
  place_id: string;
  tenant_id: string;
  vertical: Vertical;
  zip: string;
  contact_email: string | null;
  status: BusinessStatus;
  audit_score?: number;
  sequence_part_sent: number;
  next_send_at_day?: number;
  discovered_day: number;
  source: SimBusiness;
}

interface SnoozeRow {
  place_id: string;
  tenant_id: string;
  snooze_until_day: number;
  reason: string;
}

interface SuppressionRow {
  to_email: string;
  scope: 'global' | `tenant:${string}`;
  reason: string;
  source_tenant_id: string;
}

interface QuotaCounters {
  sends: number;
  bounces: number;
  complaints: number;
}

// Day-by-day gap for the 7-part outreach sequence (days from deploy).
const SEQUENCE_GAPS = [0, 3, 5, 8, 12, 17, 23];
const SEQUENCE_LENGTH = SEQUENCE_GAPS.length;

const SIM_EPOCH_MS = Date.UTC(2026, 4, 13, 0, 0, 0); // 2026-05-13T00:00Z

export interface SimulatorOptions {
  ledger: Ledger;
  rng: Rng;
  lockStrategy: LockStrategy;
}

export class Simulator {
  private businesses = new Map<string, BusinessRow>();
  private suppressions: SuppressionRow[] = [];
  private snoozes: SnoozeRow[] = [];
  private quota = new Map<string, QuotaCounters>();
  // Per-(tenant, zip, vertical) pagination cursor — mirrors real
  // Google Places pagetoken behavior. Each tenant advances through
  // the shared pool independently, but the underlying lead order is
  // identical (so collisions on the same place_id can still happen).
  private discoverCursors = new Map<string, number>();

  // For lock=none, we model the pre-migration state where each tenant
  // independently runs the pipeline against the same place_id. Key by
  // (tenant, place_id) instead of place_id alone.
  private keyFor(tenantId: string, placeId: string): string {
    return this.opts.lockStrategy === 'none'
      ? `${tenantId}|${placeId}`
      : placeId;
  }

  constructor(private opts: SimulatorOptions) {}

  // ============================================================
  // Step 1 — Discovery batch (one tenant, one simulated day)
  // ============================================================
  runDiscoverBatch(tenant: TenantConfig, day: number): void {
    for (const territory of tenant.territories) {
      const cursorKey = `${tenant.id}|${territory.zip}|${territory.vertical}`;
      const offset = this.discoverCursors.get(cursorKey) ?? 0;
      const poolSize = mockPoolSize(territory.zip, territory.vertical);
      if (offset >= poolSize) continue; // territory exhausted for this tenant
      const candidates = mockGooglePlacesDiscover(
        territory.zip,
        territory.vertical,
        territory.yieldPerBatch,
        offset,
      );
      this.discoverCursors.set(cursorKey, offset + territory.yieldPerBatch);
      for (const candidate of candidates) {
        this.attemptClaim(tenant, candidate, day);
      }
    }
  }

  private attemptClaim(
    tenant: TenantConfig,
    candidate: SimBusiness,
    day: number,
  ): void {
    const key = this.keyFor(tenant.id, candidate.id);

    // Truly idempotent re-discovery: I myself already claimed this.
    // (Under lock=none key includes tenant_id, so this only matches
    // my own claims. Under advisory/race, key is place_id alone, so
    // we must explicitly check ownership before treating as no-op.)
    const existingForKey = this.businesses.get(key);
    if (existingForKey && existingForKey.tenant_id === tenant.id) {
      return;
    }

    // Under 'none', no cross-tenant check. Just create our shadow.
    if (this.opts.lockStrategy === 'none') {
      // Detect that another tenant ALSO has a shadow for this place_id
      // (the friendly-fire signal we want to count).
      const collided = [...this.businesses.values()].some(
        b => b.source.id === candidate.id && b.tenant_id !== tenant.id,
      );
      this.createBusiness(tenant, candidate, day);
      this.event(tenant.id, candidate, day, 'discover_won', undefined, 'discovered', 'info', { collided });
      if (collided) {
        this.event(tenant.id, candidate, day, 'discover_collision', undefined, undefined, 'warn', {
          note: 'another tenant already had an independent shadow of this place_id',
        });
      }
      this.runAuditMockupDeploy(this.businesses.get(key)!, day);
      return;
    }

    // 'advisory' and 'race' both share single-owner semantics. The
    // model difference is the cost of detection (advisory: extra
    // SELECT round-trip; race: atomic INSERT...RETURNING). In this
    // sequential simulator they behave identically, so we collapse
    // them — but emit different action vocabulary so the report can
    // show which strategy was in effect.
    const existing = [...this.businesses.values()].find(
      b => b.source.id === candidate.id,
    );
    if (existing) {
      // Lost the race / advisory check tripped.
      this.event(tenant.id, candidate, day, 'discover_lost', undefined, undefined, 'info', {
        held_by: existing.tenant_id,
        strategy: this.opts.lockStrategy,
      });
      return;
    }
    // Won the claim.
    this.createBusiness(tenant, candidate, day);
    this.event(tenant.id, candidate, day, 'discover_won', undefined, 'discovered', 'info', {
      strategy: this.opts.lockStrategy,
    });
    this.runAuditMockupDeploy(this.businesses.get(key)!, day);
  }

  private createBusiness(tenant: TenantConfig, candidate: SimBusiness, day: number): void {
    const key = this.keyFor(tenant.id, candidate.id);
    this.businesses.set(key, {
      place_id: candidate.id,
      tenant_id: tenant.id,
      vertical: candidate.vertical,
      zip: candidate.zip,
      contact_email: null,
      status: 'discovered',
      sequence_part_sent: 0,
      discovered_day: day,
      source: candidate,
    });
  }

  // ============================================================
  // Step 2-5 — Audit, Mockup, Deploy (same-day, instant)
  // ============================================================
  private runAuditMockupDeploy(row: BusinessRow, day: number): void {
    // Audit
    const audit = mockAudit(this.opts.rng, row.source);
    row.audit_score = audit.score;
    row.contact_email = audit.contactEmail;
    if (!audit.contactEmail) {
      row.status = 'audit_no_email';
      this.event(row.tenant_id, row.source, day, 'audit_no_email', 'discovered', row.status, 'info',
        { score: audit.score });
      return;
    }
    this.event(row.tenant_id, row.source, day, 'audit', 'discovered', 'discovered', 'info',
      { score: audit.score, contact_email: audit.contactEmail });

    // Mockup
    const mockup = mockMockupGenerate(row.source);
    if (!mockup.ok) {
      row.status = 'mockup_no_template';
      this.event(row.tenant_id, row.source, day, 'mockup_no_template', 'discovered', row.status, 'warn',
        { vertical: row.vertical, note: 'tenant attempted vertical with no built templates' });
      return;
    }
    this.event(row.tenant_id, row.source, day, 'mockup_generated', 'discovered', 'mockup_ready', 'info',
      { template_count: mockup.templateCount });
    row.status = 'mockup_ready';

    // Deploy
    const deploy = mockCloudflareDeploy(this.opts.rng);
    if (!deploy.ok) {
      row.status = 'deploy_failed';
      this.event(row.tenant_id, row.source, day, 'deploy_failure', 'mockup_ready', row.status, 'warn',
        { note: 'transient Cloudflare Pages failure (5%)' });
      return;
    }
    this.event(row.tenant_id, row.source, day, 'deploy_success', 'mockup_ready', 'deployed', 'info');
    row.status = 'deployed';

    // Schedule first email immediately (part index 0, gap day 0)
    row.next_send_at_day = day + SEQUENCE_GAPS[0]!;
    row.status = 'emailing';
  }

  // ============================================================
  // Per-tick maintenance: scheduled sends + snooze wakes
  // ============================================================
  processScheduledSends(day: number, tenants: TenantConfig[]): void {
    const tenantById = new Map(tenants.map(t => [t.id, t]));
    for (const row of this.businesses.values()) {
      if (row.status !== 'emailing') continue;
      if (row.next_send_at_day == null || row.next_send_at_day > day) continue;
      const tenant = tenantById.get(row.tenant_id);
      if (!tenant) continue;
      this.sendNextPart(tenant, row, day);
    }
  }

  processSnoozeQueue(day: number): void {
    const woken: SnoozeRow[] = [];
    for (const s of this.snoozes) {
      if (s.snooze_until_day > day) continue;
      const key = this.keyFor(s.tenant_id, s.place_id);
      const row = this.businesses.get(key);
      if (!row) continue;
      if (row.sequence_part_sent >= SEQUENCE_LENGTH) continue;
      // Re-enter funnel by scheduling the next part for today.
      row.status = 'emailing';
      row.next_send_at_day = day;
      this.event(row.tenant_id, row.source, day, 'snooze_woken', 'snoozed', 'emailing', 'info',
        { snoozed_for_days: day - (s.snooze_until_day - day) });
      woken.push(s);
    }
    this.snoozes = this.snoozes.filter(s => !woken.includes(s));
  }

  // ============================================================
  // Email send (with suppression + quota checks)
  // ============================================================
  private sendNextPart(tenant: TenantConfig, row: BusinessRow, day: number): void {
    const partIndex = row.sequence_part_sent; // 0-based; about to send part (partIndex+1)

    // 1. Hard suppression check
    if (row.contact_email && this.isSuppressed(row.contact_email, tenant.id)) {
      this.event(tenant.id, row.source, day, 'email_skipped_suppressed', 'emailing', 'unsubbed', 'warn',
        { to_email: row.contact_email });
      row.status = 'unsubbed';
      return;
    }

    // 2. Daily quota check (warm-up curve)
    const cap = tenant.sendCapWarmup(day);
    const dateStr = simIso(SIM_EPOCH_MS, day, 9).slice(0, 10);
    const qkey = `${tenant.id}|${tenant.fromDomain}|${dateStr}`;
    const counters = this.quota.get(qkey) ?? { sends: 0, bounces: 0, complaints: 0 };
    if (counters.sends >= cap) {
      // Defer 1 day
      row.next_send_at_day = day + 1;
      this.event(tenant.id, row.source, day, 'email_skipped_quota', 'emailing', 'emailing', 'warn',
        { from_domain: tenant.fromDomain, cap, sends_today: counters.sends });
      return;
    }

    // 3. Roll the dice, send.
    counters.sends += 1;
    this.quota.set(qkey, counters);
    row.sequence_part_sent += 1;
    const dice = mockEmailSend(this.opts.rng, row.vertical);

    const baseDetails = {
      part: row.sequence_part_sent,
      from_domain: tenant.fromDomain,
      from_address: tenant.fromAddress,
      to_email: row.contact_email,
    };

    switch (dice.outcome) {
      case 'delivered':
        this.event(tenant.id, row.source, day, 'email_send', 'emailing', 'emailing', 'info',
          { ...baseDetails, outcome: 'delivered' });
        this.scheduleNextPart(row, day);
        break;
      case 'reply':
        this.event(tenant.id, row.source, day, 'email_reply', 'emailing', 'replied', 'info', baseDetails);
        row.status = 'replied';
        row.next_send_at_day = undefined;
        break;
      case 'snooze': {
        const days = dice.snoozeDays ?? 14;
        this.event(tenant.id, row.source, day, 'email_snooze', 'emailing', 'snoozed', 'info',
          { ...baseDetails, snooze_days: days });
        row.status = 'snoozed';
        row.next_send_at_day = undefined;
        this.snoozes.push({
          place_id: row.place_id,
          tenant_id: row.tenant_id,
          snooze_until_day: day + days,
          reason: 'soft_reply',
        });
        break;
      }
      case 'unsub':
        this.event(tenant.id, row.source, day, 'email_unsub', 'emailing', 'unsubbed', 'warn', baseDetails);
        row.status = 'unsubbed';
        row.next_send_at_day = undefined;
        if (row.contact_email) {
          this.suppressions.push({
            to_email: row.contact_email,
            scope: 'global',
            reason: 'unsubscribed',
            source_tenant_id: tenant.id,
          });
        }
        break;
      case 'bounced':
        counters.bounces += 1;
        this.quota.set(qkey, counters);
        this.event(tenant.id, row.source, day, 'email_bounce', 'emailing', 'bounced', 'error', baseDetails);
        row.status = 'bounced';
        row.next_send_at_day = undefined;
        if (row.contact_email) {
          this.suppressions.push({
            to_email: row.contact_email,
            scope: 'global',
            reason: 'bounced_hard',
            source_tenant_id: tenant.id,
          });
        }
        break;
      case 'complaint':
        counters.complaints += 1;
        this.quota.set(qkey, counters);
        this.event(tenant.id, row.source, day, 'email_complaint', 'emailing', 'complained', 'error', baseDetails);
        row.status = 'complained';
        row.next_send_at_day = undefined;
        if (row.contact_email) {
          this.suppressions.push({
            to_email: row.contact_email,
            scope: 'global',
            reason: 'complained',
            source_tenant_id: tenant.id,
          });
        }
        break;
      case 'no_response':
        // Should never be returned by mockEmailSend but keep exhaustive
        this.scheduleNextPart(row, day);
        break;
    }
  }

  private scheduleNextPart(row: BusinessRow, day: number): void {
    const nextPartIndex = row.sequence_part_sent; // already incremented
    if (nextPartIndex >= SEQUENCE_LENGTH) {
      this.event(row.tenant_id, row.source, day, 'sequence_exhausted',
        'emailing', 'exhausted', 'info', { parts_sent: row.sequence_part_sent });
      row.status = 'exhausted';
      row.next_send_at_day = undefined;
      return;
    }
    const gap = SEQUENCE_GAPS[nextPartIndex]! - SEQUENCE_GAPS[nextPartIndex - 1]!;
    row.next_send_at_day = day + gap;
  }

  // ============================================================
  // Suppression lookup
  // ============================================================
  private isSuppressed(email: string, tenantId: string): boolean {
    return this.suppressions.some(s =>
      s.to_email === email &&
      (s.scope === 'global' || s.scope === `tenant:${tenantId}`),
    );
  }

  // ============================================================
  // Convenience: emit a typed event with sim-clock derived ts
  // ============================================================
  private event(
    tenantId: string,
    biz: SimBusiness,
    day: number,
    action: Action,
    prev?: BusinessStatus | undefined,
    next?: BusinessStatus | undefined,
    severity: 'info' | 'warn' | 'error' = 'info',
    details?: Record<string, unknown>,
  ): void {
    this.opts.ledger.write({
      ts: new Date().toISOString(),
      sim_day: day,
      sim_ts: simIso(SIM_EPOCH_MS, day, 9),
      tenant_id: tenantId,
      business_id: biz.id,
      vertical: biz.vertical,
      zip: biz.zip,
      action,
      prev_state: prev,
      new_state: next,
      severity,
      lock_strategy: this.opts.lockStrategy,
      details,
    });
  }

  // ============================================================
  // Public read helpers (used by analyzer + run.ts summary print)
  // ============================================================
  snapshot() {
    return {
      businesses: this.businesses.size,
      suppressions: this.suppressions.length,
      pendingSnoozes: this.snoozes.length,
      quotaRows: this.quota.size,
    };
  }

  countDiscoveredInteractions(): number {
    return this.businesses.size;
  }
}

export const SIM_CONSTANTS = { SIM_EPOCH_MS, SEQUENCE_GAPS, SEQUENCE_LENGTH };
