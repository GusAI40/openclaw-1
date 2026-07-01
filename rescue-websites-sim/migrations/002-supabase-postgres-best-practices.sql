-- ============================================================
-- Migration 002 - Supabase Postgres best-practices hardening
-- ============================================================
--
-- Scope:
--   - Add missing tenant/query indexes for the rescue-websites pipeline.
--   - Replace application read-modify-write send quota increments with one
--     database-side atomic function.
--   - Document the RLS blocker instead of adding false-security policies.
--
-- Supabase validation date: 2026-06-30
-- Official docs checked:
--   - https://supabase.com/docs/guides/database/postgres/row-level-security
--   - https://supabase.com/docs/guides/api/securing-your-api
--   - https://supabase.com/docs/guides/database/query-optimization
--   - https://supabase.com/docs/guides/database/database-advisors
--   - https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- RLS note:
--   This app currently uses SUPABASE_ANON_KEY from server-side code and writes
--   tenant_id from env.TENANT_ID. A strict tenant RLS policy cannot safely trust
--   tenant_id supplied by the client request. Before enabling tenant RLS, move
--   this pipeline to one of these patterns:
--     1. Supabase Auth/JWT with a server-issued immutable tenant_id claim, or
--     2. server-only service-role access plus private RPC functions that enforce
--        tenant rules, or
--     3. separate Supabase projects per paid tenant.
--
-- Do not add "TO anon USING (tenant_id = tenant_id)" style policies. That looks
-- protected but gives every caller access to every tenant row.

BEGIN;

-- ============================================================
-- 1. Indexes for tenant-scoped reads and write paths
-- ============================================================

-- getBusinessesByStatus(status): filters tenant_id + status, orders by discovered_at.
CREATE INDEX IF NOT EXISTS idx_wr_businesses_tenant_status_discovered
  ON website_rescue_businesses (tenant_id, status, discovered_at);

-- getBusinessBySlug(slug): filters tenant_id + slug.
CREATE INDEX IF NOT EXISTS idx_wr_businesses_tenant_slug
  ON website_rescue_businesses (tenant_id, slug);

-- getAuditByBusinessId/getCrawlData: filters tenant_id + business_id, orders newest first.
CREATE INDEX IF NOT EXISTS idx_wr_audits_tenant_business_created
  ON website_rescue_audits (tenant_id, business_id, created_at DESC);

-- saveAudit/saveEmail joins and deletes benefit from indexed FK side.
CREATE INDEX IF NOT EXISTS idx_wr_audits_business_id
  ON website_rescue_audits (business_id);

CREATE INDEX IF NOT EXISTS idx_wr_emails_business_id
  ON website_rescue_emails (business_id);

CREATE INDEX IF NOT EXISTS idx_wr_emails_tenant_business
  ON website_rescue_emails (tenant_id, business_id);

-- wakeReadySnoozes(): filters tenant_id + resolved_at + snooze_until.
CREATE INDEX IF NOT EXISTS idx_wr_snoozes_tenant_ready
  ON website_rescue_snoozes (tenant_id, snooze_until)
  WHERE resolved_at IS NULL;

-- Supabase advisor 0001: Postgres does not index foreign key columns
-- automatically. These cover existing rescue-related FKs that were still
-- reported after migration 001.
CREATE INDEX IF NOT EXISTS idx_wr_snoozes_business_id
  ON website_rescue_snoozes (business_id);

CREATE INDEX IF NOT EXISTS idx_wr_outreach_log_lead_id
  ON website_rescue_outreach_log (lead_id);

CREATE INDEX IF NOT EXISTS idx_wr_data_prospects_assigned_rep_id
  ON website_rescue_data_prospects (assigned_rep_id);

-- isSuppressed(): existing index is (to_email, scope). Keep it. This partial
-- index helps global suppression checks stay cheap as tenant scoped rows grow.
CREATE INDEX IF NOT EXISTS idx_wr_suppressions_global_email
  ON website_rescue_suppressions (to_email)
  WHERE scope = 'global';

-- ============================================================
-- 2. Atomic quota increment
-- ============================================================

CREATE OR REPLACE FUNCTION increment_website_rescue_send_quota(
  p_tenant_id text,
  p_from_domain text,
  p_send_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sends integer;
BEGIN
  INSERT INTO website_rescue_send_quota (
    tenant_id,
    from_domain,
    send_date,
    sends,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_from_domain,
    p_send_date,
    1,
    now()
  )
  ON CONFLICT (tenant_id, from_domain, send_date)
  DO UPDATE SET
    sends = website_rescue_send_quota.sends + 1,
    updated_at = now()
  RETURNING sends INTO v_sends;

  RETURN v_sends;
END;
$$;

-- Public EXECUTE is Postgres' default for new functions. Revoke first, then
-- grant only the roles this server-side pipeline may use.
REVOKE ALL ON FUNCTION increment_website_rescue_send_quota(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_website_rescue_send_quota(text, text, date) TO anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- Verification queries
-- ============================================================
--
-- SELECT indexname
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND indexname IN (
--      'idx_wr_businesses_tenant_status_discovered',
--      'idx_wr_businesses_tenant_slug',
--      'idx_wr_audits_tenant_business_created',
--      'idx_wr_audits_business_id',
--      'idx_wr_emails_business_id',
--      'idx_wr_emails_tenant_business',
--      'idx_wr_snoozes_tenant_ready',
--      'idx_wr_snoozes_business_id',
--      'idx_wr_outreach_log_lead_id',
--      'idx_wr_data_prospects_assigned_rep_id',
--      'idx_wr_suppressions_global_email'
--    )
--  ORDER BY indexname;
--
-- SELECT increment_website_rescue_send_quota('migration_smoke', 'example.com', CURRENT_DATE);
--
-- SELECT tenant_id, from_domain, send_date, sends
--   FROM website_rescue_send_quota
--  WHERE tenant_id = 'migration_smoke'
--    AND from_domain = 'example.com'
--    AND send_date = CURRENT_DATE;
