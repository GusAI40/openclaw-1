-- ============================================================
-- Migration 001 — Tenant isolation for rescue-websites pipeline
-- ============================================================
--
-- STATUS: APPLIED + VALIDATED — verified live 2026-05-29.
--   Sim gate (the original precondition) PASSED: lock=none -> 322 places
--   double-claimed / 103 emails double-targeted; lock=advisory and lock=race
--   -> 0 / 0. The tenant_id + claim-lock mechanism this migration adds is
--   confirmed effective at eliminating Friendly Fire.
--   Live schema verified present: tenant_id/claimed_at/sequence_part_sent/
--   next_send_at on businesses; tenant_id on audits + emails; the three new
--   tables (suppressions, snoozes, send_quota); all idx_wr_* indexes; the
--   suppressions shape (7 cols). Idempotent (IF NOT EXISTS) — safe to re-run.
--   In ACTIVE USE: website_rescue_businesses backfill = gus:4, julian:1440
--   (tenant isolation working, no collisions observed).
-- Target Supabase project: bjhjqegqfieyekbffgij (tag-ai-data)
-- Authored: 2026-05-13 (post 2026-05-12 v2 session) | Applied: on/before 2026-05-29
-- Author: Claude (under Gus's direction)
--
-- WHY THIS EXISTS
-- ----------------
-- The current `website_rescue_*` schema has no concept of tenancy.
-- Both Gus and Julian use the same Supabase project + same
-- service_role key, so when both tenants run discovery against the
-- same ZIP+vertical, they BOTH attempt INSERTs against the same
-- google-place-id PK. Whoever loses the race silently has their
-- discovery dropped, but the failure mode for downstream steps is
-- worse: there is no record of "lead claimed by gus, julian stop"
-- so Julian's pipeline keeps running independently, leading to
-- DOUBLE OUTREACH from julian@ubntag.com AND gus@ubntag.com to the
-- same business owner. That's "Friendly Fire" (blindspot #1).
--
-- This migration also adds the missing infrastructure for the
-- other two blindspots flagged in session log 2026-05-12 v2:
--   * Unsubscribe vs Snooze — a global suppression list + a
--     per-(tenant, business) snooze queue.
--   * Reputation Burn — a per-(tenant, from_domain, day) quota
--     tracker so the pipeline can self-throttle before Resend does.
--
-- DESIGN PRINCIPLES
-- -----------------
-- 1. Idempotent — every change uses IF NOT EXISTS / IF EXISTS so
--    the script can be re-run safely.
-- 2. Non-destructive — no DROP COLUMN, no DROP INDEX. Existing
--    data + FKs preserved.
-- 3. Backfill-friendly — added NOT NULL columns get a DEFAULT so
--    existing rows (all currently belong to gus) get auto-stamped.
-- 4. Two pre-existing tables (`website_rescue_business_leads`,
--    `website_rescue_outreach_log`) are referenced ONLY by
--    src/god-mode/* which is not wired into npm scripts. This
--    migration leaves them untouched.
--
-- REVERT PLAN
-- -----------
-- See migrations/001-revert.sql (to be written if anything goes
-- wrong post-apply). Drops added columns + tables, restores prior
-- state. Test against a Supabase branch DB before relying on it.

BEGIN;

-- ============================================================
-- 1. Add tenant_id to existing tables
-- ============================================================
-- The PK on website_rescue_businesses (TEXT id = google_place_id)
-- already enforces global uniqueness, so the LOCK mechanism is
-- trivially `INSERT ... ON CONFLICT (id) DO NOTHING RETURNING *`.
-- The application reads RETURNING; empty = lost the race = skip.
--
-- We add tenant_id NOT NULL DEFAULT 'gus' so that:
--   - existing rows backfill cleanly (only Gus has used prod)
--   - new INSERTs from Julian's pipeline must specify tenant_id
--     (the default catches missed call sites during rollout)
-- After Julian's first run, tighten to NOT NULL with no default.

ALTER TABLE website_rescue_businesses
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'gus';

ALTER TABLE website_rescue_businesses
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT now();

-- Sequence state for the 7-part email cadence
-- (currently the pipeline has no place to store "which part did we send last")
ALTER TABLE website_rescue_businesses
  ADD COLUMN IF NOT EXISTS sequence_part_sent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE website_rescue_businesses
  ADD COLUMN IF NOT EXISTS next_send_at TIMESTAMPTZ;

-- Denormalize tenant_id onto child tables for cheap per-tenant
-- analytics (avoids JOIN on every dashboard query).
ALTER TABLE website_rescue_audits
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'gus';

ALTER TABLE website_rescue_emails
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'gus';

-- ============================================================
-- 2. Suppression list (Unsubscribe — blindspot #2, hard side)
-- ============================================================
-- Hard suppressions are GLOBAL by default — once a recipient says
-- "stop", no tenant in the org may ever email them again. CAN-SPAM
-- + GDPR compliance baseline.
--
-- Per-tenant suppressions are ALSO supported (scope = 'tenant:<id>')
-- for cases like "Julian's tenant should not email this customer
-- because Julian closed them" but Gus is allowed to follow up
-- with a different product. Default scope is 'global'.

CREATE TABLE IF NOT EXISTS website_rescue_suppressions (
  id                  SERIAL PRIMARY KEY,
  to_email            TEXT NOT NULL,
  scope               TEXT NOT NULL DEFAULT 'global',
  reason              TEXT NOT NULL,
  source_tenant_id    TEXT NOT NULL,
  source_business_id  TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wr_suppressions_scope_chk
    CHECK (scope = 'global' OR scope LIKE 'tenant:%'),
  CONSTRAINT wr_suppressions_reason_chk
    CHECK (reason IN (
      'unsubscribed',     -- list-unsubscribe header click
      'replied_stop',     -- inbox parser saw "stop" / "remove me"
      'bounced_hard',     -- 5xx bounce
      'complained',       -- spam report from ESP feedback loop
      'manual'            -- operator-added
    ))
);

-- An email may have multiple suppression records (e.g. one tenant
-- adds it, then another sees a complaint), so no UNIQUE on to_email
-- alone. The pipeline's pre-send check is:
--   SELECT 1 FROM website_rescue_suppressions
--    WHERE to_email = $1
--      AND (scope = 'global' OR scope = 'tenant:' || $tenant_id)
--    LIMIT 1;

CREATE INDEX IF NOT EXISTS idx_wr_suppressions_email_scope
  ON website_rescue_suppressions (to_email, scope);

-- ============================================================
-- 3. Snooze queue (Unsubscribe — blindspot #2, soft side)
-- ============================================================
-- "Email me next Tuesday" is fundamentally different from
-- "never email me." Snooze defers the lead in the funnel and
-- re-enters them at snooze_until.
--
-- Snoozes are per-(tenant, business) — Gus's snooze of a lead
-- has no bearing on Julian's pipeline state for that lead.

CREATE TABLE IF NOT EXISTS website_rescue_snoozes (
  id            SERIAL PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES website_rescue_businesses(id),
  tenant_id     TEXT NOT NULL,
  snooze_until  TIMESTAMPTZ NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,  -- set when the snooze actually fires
  CONSTRAINT wr_snoozes_future_chk CHECK (snooze_until > created_at)
);

-- "What snoozes are ready to wake up?" — the only query that matters
CREATE INDEX IF NOT EXISTS idx_wr_snoozes_pending
  ON website_rescue_snoozes (snooze_until)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wr_snoozes_tenant_business
  ON website_rescue_snoozes (tenant_id, business_id)
  WHERE resolved_at IS NULL;

-- ============================================================
-- 4. Send quota (Reputation Burn — blindspot #3)
-- ============================================================
-- One row per (tenant, from_domain, calendar_date). Pipeline
-- INCREMENTs `sends` BEFORE actually sending; if the increment
-- would exceed daily_cap, the send is deferred via a snooze
-- of 24h (or whatever the warm-up policy says).
--
-- bounces / complaints are written by the Resend webhook handler
-- (out of scope for this migration but the columns exist for
-- when that handler is added).
--
-- Daily caps live in CODE (per-tenant config), not in this table,
-- so we can ramp warm-up curves without DB writes.

CREATE TABLE IF NOT EXISTS website_rescue_send_quota (
  tenant_id    TEXT NOT NULL,
  from_domain  TEXT NOT NULL,
  send_date    DATE NOT NULL,
  sends        INTEGER NOT NULL DEFAULT 0,
  bounces      INTEGER NOT NULL DEFAULT 0,
  complaints   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, from_domain, send_date)
);

-- "Show me Julian's send rate on ubntag.com over the last 14 days"
CREATE INDEX IF NOT EXISTS idx_wr_send_quota_tenant_domain_date
  ON website_rescue_send_quota (tenant_id, from_domain, send_date DESC);

-- ============================================================
-- 5. Per-tenant indexes on businesses
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wr_businesses_tenant_status
  ON website_rescue_businesses (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wr_businesses_next_send
  ON website_rescue_businesses (next_send_at)
  WHERE next_send_at IS NOT NULL AND status = 'emailing';

-- ============================================================
-- 6. Status vocabulary (informational comment, not enforced)
-- ============================================================
-- The `status` column on website_rescue_businesses uses these
-- values in the post-migration pipeline:
--
--   discovered    — claim won, awaiting audit
--   audited       — audit complete, awaiting mockup
--   mockup_ready  — mockups generated, awaiting deploy
--   deployed      — live URL, awaiting first email
--   emailing      — in 7-part sequence, next_send_at populated
--   replied       — terminal: prospect replied (move to CRM)
--   snoozed       — soft defer, see website_rescue_snoozes
--   unsubbed      — terminal: hard suppression added
--   bounced       — terminal: hard bounce, suppression added
--   exhausted     — terminal: 7 parts sent, no reply
--   released      — claim manually released, available for re-discover
--
-- A CHECK constraint is intentionally NOT added so the simulator
-- and pipeline can iterate on this vocabulary without migrations.

COMMIT;

-- ============================================================
-- Verification queries (run after apply, NOT inside the txn)
-- ============================================================
--
-- 1. Confirm new columns exist
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'website_rescue_businesses'
--    AND column_name IN ('tenant_id','claimed_at','sequence_part_sent','next_send_at')
--  ORDER BY column_name;
--
-- 2. Confirm backfill worked (all existing rows = gus)
-- SELECT tenant_id, COUNT(*) FROM website_rescue_businesses GROUP BY 1;
--
-- 3. Confirm new tables
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('website_rescue_suppressions','website_rescue_snoozes','website_rescue_send_quota')
--  ORDER BY table_name;
--
-- 4. Confirm indexes
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND indexname LIKE 'idx_wr_%'
--  ORDER BY indexname;
