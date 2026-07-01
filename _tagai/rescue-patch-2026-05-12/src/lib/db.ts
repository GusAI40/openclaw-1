import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import type { Business, PipelineStatus } from './types.js';

const TABLE_BUSINESSES = 'website_rescue_businesses';
const TABLE_AUDITS = 'website_rescue_audits';
const TABLE_EMAILS = 'website_rescue_emails';
const TABLE_SUPPRESSIONS = 'website_rescue_suppressions';
const TABLE_SNOOZES = 'website_rescue_snoozes';
const TABLE_SEND_QUOTA = 'website_rescue_send_quota';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return _supabase;
}

/** Backwards-compat alias */
export const getDb = getSupabase;

export async function insertBusiness(b: Business & { vertical: string; contactEmail?: string }): Promise<boolean> {
  const supabase = getSupabase();

  // Race strategy: the first tenant to INSERT wins.
  // We use .insert() instead of .upsert() because we WANT it to fail if someone else got it.
  const { data, error } = await supabase
    .from(TABLE_BUSINESSES)
    .insert({
      id: b.id,
      tenant_id: env.TENANT_ID,
      name: b.name,
      slug: b.slug,
      website: b.website,
      phone: b.phone,
      address: b.address,
      city: b.city,
      state: b.state,
      zip: b.zip,
      category: b.category,
      vertical: b.vertical,
      rating: b.rating,
      review_count: b.reviewCount,
      lat: b.lat,
      lng: b.lng,
      contact_email: b.contactEmail ?? null,
      discovered_at: b.discoveredAt,
      status: 'discovered'
    })
    .select();

  if (error) {
    // If it's a unique constraint violation on 'id', someone else won the race.
    if (error.code === '23505') {
      return false;
    }
    console.error('insertBusiness error:', error.message);
    return false;
  }

  return true;
}

export async function updateStatus(businessId: string, status: PipelineStatus): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    status,
    updated_at: now,
  };

  const timestampCols: Record<string, string> = {
    audited: 'audited_at',
    emailed: 'emailed_at',
  };

  const dateCol = timestampCols[status];
  if (dateCol) {
    updates[dateCol] = now;
  }

  const { error } = await supabase
    .from(TABLE_BUSINESSES)
    .update(updates)
    .eq('id', businessId)
    .eq('tenant_id', env.TENANT_ID);

  if (error) console.error('updateStatus error:', error.message);
}

export async function saveAudit(businessId: string, reportData: string, overallScore: number, crawlData?: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE_AUDITS)
    .insert({
      business_id: businessId,
      tenant_id: env.TENANT_ID,
      report_data: reportData,
      overall_score: overallScore,
      crawl_data: crawlData ?? null,
    });

  if (error) {
    console.error('saveAudit error:', error.message);
    return false;
  }
  return true;
}

export async function getCrawlData(businessId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE_AUDITS)
    .select('crawl_data')
    .eq('business_id', businessId)
    .eq('tenant_id', env.TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0 || !data[0].crawl_data) return [];

  try {
    const parsed = typeof data[0].crawl_data === 'string'
      ? JSON.parse(data[0].crawl_data)
      : data[0].crawl_data;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveEmail(businessId: string, toEmail: string, subject: string, reportUrl: string, resendId?: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE_EMAILS)
    .insert({
      business_id: businessId,
      tenant_id: env.TENANT_ID,
      to_email: toEmail,
      subject,
      resend_id: resendId ?? null,
      report_url: reportUrl,
    });

  if (error) console.error('saveEmail error:', error.message);
}

export async function getBusinessesByStatus(status: PipelineStatus, limit = 50): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE_BUSINESSES)
    .select('*')
    .eq('status', status)
    .eq('tenant_id', env.TENANT_ID)
    .order('discovered_at')
    .limit(limit);

  if (error) {
    console.error('getBusinessesByStatus error:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getBusinessBySlug(slug: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE_BUSINESSES)
    .select('*')
    .eq('slug', slug)
    .eq('tenant_id', env.TENANT_ID)
    .single();

  if (error) return null;
  return data;
}

export async function getAuditByBusinessId(businessId: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE_AUDITS)
    .select('*')
    .eq('business_id', businessId)
    .eq('tenant_id', env.TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function setContactEmail(businessId: string, email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE_BUSINESSES)
    .update({ contact_email: email, updated_at: new Date().toISOString() })
    .eq('id', businessId)
    .eq('tenant_id', env.TENANT_ID);

  if (error) console.error('setContactEmail error:', error.message);
}

export async function getStats(): Promise<Record<string, number>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE_BUSINESSES)
    .select('status')
    .eq('tenant_id', env.TENANT_ID);

  if (error || !data) {
    console.error('getStats error:', error?.message);
    return { total: 0, discovered: 0, audited: 0, emailed: 0 };
  }

  const total = data.length;
  const discovered = data.filter((r) => r.status === 'discovered').length;
  const audited = data.filter((r) => r.status === 'audited' || r.status === 'report_generated').length;
  const emailed = data.filter((r) => r.status === 'emailed').length;

  return { total, discovered, audited, emailed };
}

// ============================================================
// Migration 001 helpers — suppression / snooze / quota
// ============================================================
// All three were added by migrations/001-add-tenant-isolation.sql
// (applied 2026-05-12 to bjhjqegqfieyekbffgij). The simulator
// (rescue-websites-sim) proved that without these gates the
// pipeline produces 322 double-claims + 103 double-targeted
// emails per 1000 interactions. With these gates: 0 / 0.

/**
 * Pre-send suppression gate.
 *
 * Matches global suppressions (any tenant) AND per-tenant
 * suppressions scoped to env.TENANT_ID. Hard suppressions
 * (unsub, bounce, complaint) are global by default.
 */
export async function isSuppressed(toEmail: string): Promise<boolean> {
  const supabase = getSupabase();
  const tenantScope = `tenant:${env.TENANT_ID}`;
  const { data, error } = await supabase
    .from(TABLE_SUPPRESSIONS)
    .select('id')
    .eq('to_email', toEmail.toLowerCase())
    .in('scope', ['global', tenantScope])
    .limit(1);

  if (error) {
    // Fail SAFE — if we can't prove they're NOT suppressed, don't send.
    console.error('isSuppressed error (failing safe → suppressed):', error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Add a suppression record. Default scope is 'global' (CAN-SPAM
 * baseline: once a recipient says stop, no tenant emails them).
 * Use scope='tenant:<id>' for soft per-tenant suppressions.
 */
export async function addSuppression(opts: {
  toEmail: string;
  reason: 'unsubscribed' | 'replied_stop' | 'bounced_hard' | 'complained' | 'manual';
  sourceBusinessId?: string;
  scope?: 'global' | string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE_SUPPRESSIONS)
    .insert({
      to_email: opts.toEmail.toLowerCase(),
      scope: opts.scope ?? 'global',
      reason: opts.reason,
      source_tenant_id: env.TENANT_ID,
      source_business_id: opts.sourceBusinessId ?? null,
    });

  if (error) console.error('addSuppression error:', error.message);
}

/**
 * Soft-defer a lead. Flips business status to 'snoozed' and
 * inserts a snooze record. wakeReadySnoozes() picks it back up.
 */
export async function snoozeBusiness(opts: {
  businessId: string;
  snoozeUntil: Date;
  reason?: string;
}): Promise<void> {
  const supabase = getSupabase();

  const { error: insertErr } = await supabase
    .from(TABLE_SNOOZES)
    .insert({
      business_id: opts.businessId,
      tenant_id: env.TENANT_ID,
      snooze_until: opts.snoozeUntil.toISOString(),
      reason: opts.reason ?? null,
    });
  if (insertErr) console.error('snoozeBusiness insert error:', insertErr.message);

  const { error: statusErr } = await supabase
    .from(TABLE_BUSINESSES)
    .update({ status: 'snoozed', updated_at: new Date().toISOString() })
    .eq('id', opts.businessId)
    .eq('tenant_id', env.TENANT_ID);
  if (statusErr) console.error('snoozeBusiness status error:', statusErr.message);
}

/**
 * Wake snoozes whose snooze_until <= now. For each: mark
 * resolved_at, flip business status back to 'report_generated'
 * (the pre-email state). Returns count awakened.
 *
 * Call at the start of every pipeline run.
 */
export async function wakeReadySnoozes(): Promise<number> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: ready, error: readErr } = await supabase
    .from(TABLE_SNOOZES)
    .select('id, business_id')
    .eq('tenant_id', env.TENANT_ID)
    .is('resolved_at', null)
    .lte('snooze_until', now);

  if (readErr) {
    console.error('wakeReadySnoozes read error:', readErr.message);
    return 0;
  }
  if (!ready || ready.length === 0) return 0;

  const snoozeIds = ready.map(r => r.id);
  const businessIds = ready.map(r => r.business_id);

  const { error: resolveErr } = await supabase
    .from(TABLE_SNOOZES)
    .update({ resolved_at: now })
    .in('id', snoozeIds);
  if (resolveErr) console.error('wakeReadySnoozes resolve error:', resolveErr.message);

  const { error: statusErr } = await supabase
    .from(TABLE_BUSINESSES)
    .update({ status: 'report_generated', updated_at: now })
    .in('id', businessIds)
    .eq('tenant_id', env.TENANT_ID)
    .eq('status', 'snoozed');
  if (statusErr) console.error('wakeReadySnoozes status error:', statusErr.message);

  return ready.length;
}

/**
 * Count of emails this tenant has sent on this domain today (UTC).
 * Pre-send check: if >= cap, snooze instead of send.
 */
export async function getTodaysSendCount(fromDomain: string): Promise<number> {
  const supabase = getSupabase();
  const sendDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const { data, error } = await supabase
    .from(TABLE_SEND_QUOTA)
    .select('sends')
    .eq('tenant_id', env.TENANT_ID)
    .eq('from_domain', fromDomain)
    .eq('send_date', sendDate)
    .maybeSingle();

  if (error) {
    // Fail SAFE — assume we're at cap rather than risk overshooting.
    console.error('getTodaysSendCount error (failing safe → cap):', error.message);
    return Number.MAX_SAFE_INTEGER;
  }
  return data?.sends ?? 0;
}

/**
 * Atomic-ish increment of today's send count. Read-modify-write
 * with upsert. Small race window exists if two sends fire in the
 * same ms — acceptable: one container per tenant, low send rate.
 */
export async function incrementTodaysSendCount(fromDomain: string): Promise<void> {
  const supabase = getSupabase();
  const sendDate = new Date().toISOString().slice(0, 10);

  const { error: rpcErr } = await supabase.rpc(
    'increment_website_rescue_send_quota',
    {
      p_tenant_id: env.TENANT_ID,
      p_from_domain: fromDomain,
      p_send_date: sendDate,
    },
  );

  if (!rpcErr) return;

  console.error(
    'incrementTodaysSendCount RPC error; falling back to legacy upsert:',
    rpcErr.message,
  );

  const { data: existing, error: readErr } = await supabase
    .from(TABLE_SEND_QUOTA)
    .select('sends')
    .eq('tenant_id', env.TENANT_ID)
    .eq('from_domain', fromDomain)
    .eq('send_date', sendDate)
    .maybeSingle();
  if (readErr) {
    console.error('incrementTodaysSendCount read error:', readErr.message);
    return;
  }

  const current = existing?.sends ?? 0;
  const { error: writeErr } = await supabase
    .from(TABLE_SEND_QUOTA)
    .upsert({
      tenant_id: env.TENANT_ID,
      from_domain: fromDomain,
      send_date: sendDate,
      sends: current + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,from_domain,send_date' });

  if (writeErr) console.error('incrementTodaysSendCount write error:', writeErr.message);
}
