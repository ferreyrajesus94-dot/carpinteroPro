-- ============================================================
-- Forward-only GRANT: service_role CRUD on billing_webhook_events
-- ============================================================
-- The 20260913000001_grants_and_workshop_active_protection.sql
-- migration section 2 enumerated the `service_role` CRUD GRANT
-- list for the workshop-scoped tables. That list omitted
-- public.billing_webhook_events, so the local
-- `supabase test db --local` runner does not provision the GRANT
-- the hosted stack adds implicitly. The pgTAP regression
-- tests/billing_webhook_events_grants.test.sql captures the gap:
-- `set local role service_role` followed by any CRUD against the
-- table fails with `permission denied for table
-- billing_webhook_events` before reaching RLS or trigger logic,
-- and the four admin/billing Edge Functions (admin-overview,
-- admin-retry-webhook, admin-support-diagnostics,
-- mercadopago-webhook) hit the same wall whenever they write
-- through the service_role key.
--
-- This migration adds the missing GRANT only. RLS stays enabled
-- (per 0022_billing_schema.sql:61) with no policies, so anon and
-- authenticated remain blocked at the privilege + RLS layers —
-- the table is accessed exclusively via service_role (admin Edge
-- Functions and the mercadopago-webhook EF). The GRANT is
-- naturally idempotent in Postgres; re-running this migration is
-- a no-op.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.billing_webhook_events
  TO service_role;
