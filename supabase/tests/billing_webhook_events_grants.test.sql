-- Test: billing_webhook_events service_role CRUD grants + RLS isolation
--
-- Forward-only regression for the missing
-- public.billing_webhook_events -> service_role GRANT.
--
-- Background:
--   The 2026-09-13 production-readiness audit (W3) closed the
--   missing CRUD grants for the workshop-scoped tables in
--   20260913000001_grants_and_workshop_active_protection.sql. That
--   migration's "out of scope" block (lines 52-57) intentionally
--   documents that platform-global tables — including
--   public.billing_webhook_events — "remain service_role-only"
--   and therefore do NOT receive an authenticated grant. The
--   audit text assumed the hosted Supabase stack would keep
--   provisioning the matching service_role CRUD GRANT implicitly.
--
--   The local `supabase test db --local` runner does NOT honor
--   that provisioning. Any pgTAP test that switches to
--   `set local role service_role` and then touches
--   public.billing_webhook_events fails with
--   `permission denied for table billing_webhook_events` before
--   reaching RLS or trigger logic. The same is true for the four
--   admin/billing Edge Functions (admin-overview,
--   admin-retry-webhook, admin-support-diagnostics,
--   mercadopago-webhook) the moment a future fixture writes
--   against the table while impersonating service_role.
--
--   The 0022_billing_schema.sql migration enables RLS on the
--   table and creates no policies, so anon / authenticated must
--   stay blocked at the privilege + RLS layers regardless of this
--   grant fix. This test pins both contracts.
--
-- Planned forward-only migration (NOT yet applied; this launch is
-- test-only so the verifier can capture RED first):
--
--   supabase/migrations/20260913000002_billing_webhook_events_service_role_grant.sql
--
--     -- Grants service_role full CRUD against
--     -- public.billing_webhook_events. The table is intentionally
--     -- accessed only via service_role (admin Edge Functions and
--     -- the mercadopago-webhook EF). RLS stays enabled with no
--     -- policies, so anon / authenticated remain blocked at the
--     -- privilege + RLS layers. Closes the local-fixture parity
--     -- gap left by 20260913000001_grants_and_workshop_active_protection.sql
--     -- section 2, which deliberately omitted this table from
--     -- the explicit service_role CRUD GRANT list.
--     GRANT SELECT, INSERT, UPDATE, DELETE
--       ON public.billing_webhook_events
--       TO service_role;
--
-- This test verifies:
--   1. service_role holds all four CRUD privileges on
--      public.billing_webhook_events (catalog probe via
--      has_table_privilege — locks the GRANT surface contract).
--   2. service_role can perform live CRUD against
--      public.billing_webhook_events (behavior-level via lives_ok
--      — proves the grants are wide enough in practice).
--   3. RLS remains enabled on public.billing_webhook_events
--      (defense-in-depth — the auth/anon denial path depends on
--      this even when the GRANT surface is restrictive).
--   4. No RLS policies are defined on
--      public.billing_webhook_events (a future policy leak would
--      silently widen the access surface; pinning to zero fails
--      CI deterministically).
--   5. The authenticated role is denied all four CRUD operations
--      (throws_ok with SQLSTATE 42501). Not merely SELECT — INSERT,
--      UPDATE, DELETE are exercised so a future migration that
--      grants only one of the four fails CI deterministically.
--   6. The anon role is denied all four CRUD operations (same
--      contract as T5).
--
-- The test runs inside a single transaction (begin / rollback) so
-- no fixture row persists past the run. The expected RED signal
-- before the planned migration is applied: T1.x and T2.x fail (8
-- failures). T3-T6 are guard rails that already pass against the
-- current local DB and will continue to pass after the migration.

begin;

create extension if not exists pgtap with schema extensions;

-- Plan: 18 assertions
--   T1: 4 service_role privilege probes (has_table_privilege)
--   T2: 4 service_role live CRUD (lives_ok)
--   T3: 1 RLS enabled
--   T4: 1 no RLS policies
--   T5: 4 authenticated CRUD denied (throws_ok)
--   T6: 4 anon CRUD denied (throws_ok)
select plan(18);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================
-- One workshop + two seed event rows: one that the service_role
-- live-CRUD section will mutate and a second that the auth/anon
-- denial sections will try to read or mutate. All rows are
-- inserted as the test connection's superuser (BYPASSRLS) and
-- rolled back at the end of the transaction.
create temporary table _bwge_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _bwge_ids (key, id) values
  ('workshop',  'aa000000-0000-0000-0000-000000000001'::uuid),
  ('event_seed','aa000000-0000-0000-0000-000000000002'::uuid),
  ('event_aa',  'aa000000-0000-0000-0000-000000000003'::uuid);

-- The temp table is owned by the superuser. The auth/anon throws_ok
-- blocks below reference it via a subquery; grant SELECT so the
-- privilege check on _bwge_ids succeeds BEFORE the throws_ok reaches
-- the billing_webhook_events privilege layer (otherwise we would
-- be testing the temp-table grant, not the table under test).
grant select on _bwge_ids to authenticated, service_role, anon;

-- Seed the workshop row.
insert into public.workshops (id, name) values
  ((select id from _bwge_ids where key = 'workshop'),
   'Billing Webhook Grants Test Workshop');

-- Pre-seed two event rows. Distinct provider_event_ids so the
-- unique (provider, provider_event_id) index does not collide.
insert into public.billing_webhook_events (
  id, workshop_id, provider_event_id, event_type, provider_resource_id
) values
  ((select id from _bwge_ids where key = 'event_seed'),
   (select id from _bwge_ids where key = 'workshop'),
   'evt_bwge_seed', 'preapproval.updated', 'preapproval_seed'),
  ((select id from _bwge_ids where key = 'event_aa'),
   (select id from _bwge_ids where key = 'workshop'),
   'evt_bwge_aa_target', 'payment.created', 'preapproval_aa_target');

-- ==========================================================================
-- T1: service_role holds all four CRUD privileges (catalog probe)
-- ==========================================================================
-- The catalog probe is preferred over a pure behavior test for the
-- GRANT surface because it locks the privilege bit exactly. A
-- future migration that grants only TRUNCATE, for example, would
-- still pass a behavior test on SELECT but fail this assertion.
select results_eq(
  $$
    select has_table_privilege(
      'service_role', 'public.billing_webhook_events', 'SELECT')
  $$,
  array[true],
  'T1.1: service_role has SELECT on public.billing_webhook_events'
);

select results_eq(
  $$
    select has_table_privilege(
      'service_role', 'public.billing_webhook_events', 'INSERT')
  $$,
  array[true],
  'T1.2: service_role has INSERT on public.billing_webhook_events'
);

select results_eq(
  $$
    select has_table_privilege(
      'service_role', 'public.billing_webhook_events', 'UPDATE')
  $$,
  array[true],
  'T1.3: service_role has UPDATE on public.billing_webhook_events'
);

select results_eq(
  $$
    select has_table_privilege(
      'service_role', 'public.billing_webhook_events', 'DELETE')
  $$,
  array[true],
  'T1.4: service_role has DELETE on public.billing_webhook_events'
);

-- ==========================================================================
-- T2: service_role can perform live CRUD (behavior-level)
-- ==========================================================================
-- service_role has BYPASSRLS, so RLS does not affect this section.
-- Clear any lingering JWT subject so the session looks like a true
-- service-role call (defensive — no auth.uid() reads in this table
-- today, but it keeps the section portable if a future migration
-- adds a row-scoped trigger).
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);

-- T2.1: INSERT a fresh event row.
select lives_ok(
  $$
    insert into public.billing_webhook_events
      (workshop_id, provider_event_id, event_type, provider_resource_id)
    values
      ((select id from _bwge_ids where key = 'workshop'),
       'evt_bwge_svc_live', 'subscription.updated', 'preapproval_svc_live')
  $$,
  'T2.1: service_role can INSERT into public.billing_webhook_events'
);

-- T2.2: SELECT the freshly-inserted row back.
select lives_ok(
  $$
    select 1
      from public.billing_webhook_events
     where provider_event_id = 'evt_bwge_svc_live'
  $$,
  'T2.2: service_role can SELECT from public.billing_webhook_events'
);

-- T2.3: UPDATE the row.
select lives_ok(
  $$
    update public.billing_webhook_events
       set provider_resource_id = 'preapproval_svc_live_updated'
     where provider_event_id = 'evt_bwge_svc_live'
  $$,
  'T2.3: service_role can UPDATE public.billing_webhook_events'
);

-- T2.4: DELETE the row.
select lives_ok(
  $$
    delete from public.billing_webhook_events
     where provider_event_id = 'evt_bwge_svc_live'
  $$,
  'T2.4: service_role can DELETE from public.billing_webhook_events'
);

reset role;

-- ==========================================================================
-- T3: RLS remains enabled on public.billing_webhook_events
-- ==========================================================================
-- Table-isolation baseline. The planned GRANT is for service_role
-- only; RLS must stay ON so anon / authenticated users hit the
-- privilege + RLS layers and not an implicit-PUBLIC fallback.
select results_eq(
  $$
    select relrowsecurity
      from pg_class
     where oid = 'public.billing_webhook_events'::regclass
  $$,
  array[true],
  'T3.1: RLS is enabled on public.billing_webhook_events'
);

-- ==========================================================================
-- T4: no RLS policies on public.billing_webhook_events
-- ==========================================================================
-- The table is intended to be service_role-only. A future policy
-- leak (for example a permissive SELECT policy) would silently
-- expose webhook events to authenticated users. Pinning the policy
-- count to zero makes any policy addition fail CI deterministically.
select results_eq(
  $$
    select count(*)::bigint
      from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
     where cls.relname = 'billing_webhook_events'
  $$,
  array[0::bigint],
  'T4.1: no RLS policies are defined on public.billing_webhook_events'
);

-- ==========================================================================
-- T5: authenticated role is denied all four CRUD operations
-- ==========================================================================
-- The planned GRANT targets service_role only. This section pins
-- the contract that authenticated NEVER gains table-level access,
-- independently of the policy count above. The error message is
-- the canonical Postgres privilege denial because the role has no
-- GRANT on this table at all; RLS is not reached (RLS without a
-- policy would surface a different message if the role had a GRANT).
set local role authenticated;

-- T5.1: authenticated cannot SELECT.
select throws_ok(
  $$
    select 1
      from public.billing_webhook_events
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T5.1: authenticated cannot SELECT from public.billing_webhook_events'
);

-- T5.2: authenticated cannot INSERT.
select throws_ok(
  $$
    insert into public.billing_webhook_events
      (workshop_id, provider_event_id, event_type, provider_resource_id)
    values
      ((select id from _bwge_ids where key = 'workshop'),
       'evt_bwge_auth_attempt', 'payment.created', 'preapproval_auth_attempt')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T5.2: authenticated cannot INSERT into public.billing_webhook_events'
);

-- T5.3: authenticated cannot UPDATE.
select throws_ok(
  $$
    update public.billing_webhook_events
       set provider_resource_id = 'preapproval_auth_attempt'
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T5.3: authenticated cannot UPDATE public.billing_webhook_events'
);

-- T5.4: authenticated cannot DELETE.
select throws_ok(
  $$
    delete from public.billing_webhook_events
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T5.4: authenticated cannot DELETE from public.billing_webhook_events'
);

reset role;

-- ==========================================================================
-- T6: anon role is denied all four CRUD operations
-- ==========================================================================
-- anon is the role the Data API uses for unauthenticated requests.
-- Both gates (privilege + RLS) must stay closed; this section locks
-- the privilege gate.
set local role anon;

-- T6.1: anon cannot SELECT.
select throws_ok(
  $$
    select 1
      from public.billing_webhook_events
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T6.1: anon cannot SELECT from public.billing_webhook_events'
);

-- T6.2: anon cannot INSERT.
select throws_ok(
  $$
    insert into public.billing_webhook_events
      (workshop_id, provider_event_id, event_type, provider_resource_id)
    values
      ((select id from _bwge_ids where key = 'workshop'),
       'evt_bwge_anon_attempt', 'payment.created', 'preapproval_anon_attempt')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T6.2: anon cannot INSERT into public.billing_webhook_events'
);

-- T6.3: anon cannot UPDATE.
select throws_ok(
  $$
    update public.billing_webhook_events
       set provider_resource_id = 'preapproval_anon_attempt'
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T6.3: anon cannot UPDATE public.billing_webhook_events'
);

-- T6.4: anon cannot DELETE.
select throws_ok(
  $$
    delete from public.billing_webhook_events
     where id = (select id from _bwge_ids where key = 'event_aa')
  $$,
  '42501',
  'permission denied for table billing_webhook_events',
  'T6.4: anon cannot DELETE from public.billing_webhook_events'
);

reset role;

select * from finish();
rollback;
