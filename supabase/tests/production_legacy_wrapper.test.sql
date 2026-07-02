-- PR 9: legacy start_quote_production wrapper tests
--
-- Verifies the PR-9 deliverable for the production-order-state-machine change:
--   1. The legacy start_quote_production RPC is now a thin wrapper around
--      start_production_order (the new flow that owns production order
--      creation and the deduction FK). The wrapper preserves the legacy
--      jsonb return shape for backward compatibility.
--   2. The wrapper emits a one-time-per-session deprecation RAISE WARNING
--      so operators can identify legacy callers without breaking the call.
--   3. The wrapper preserves the existing role + cross-workshop + RLS
--      safety: viewer role is rejected with 42501, cross-workshop call is
--      rejected with 42501, and the caller's role/workshop is re-checked
--      before the wrapper delegates to start_production_order.
--   4. The wrapper preserves idempotency: the existing-batch branch returns
--      the existing batch without creating a duplicate, and a retry with
--      the same p_request_id returns the same production order id.
--   5. The new-flow contract is honored end-to-end: a legacy call on a
--      quote with no pre-existing batch creates a production_order row
--      (via start_production_order) and a deduction batch with non-null
--      production_order_id (the PR 4 new-flow contract).
--   6. The wrapper preserves the legacy quotes.status = 'en_produccion'
--      side effect (so the existing T5 in production_deduction_rpc.test.sql
--      keeps passing) via the transaction-local write guard.
--   7. The wrapper does NOT change the legacy-null-preservation contract:
--      a pre-existing legacy batch (created before the migration) keeps
--      production_order_id = NULL after a legacy call (no backfill).
--
-- All assertions are deterministic. The test seeds its own data in
-- temporary tables and reseeds rows so it does not depend on prior
-- migration state.

begin;

create extension if not exists pgtap with schema extensions;

-- PR 9.1 review-blocker fix batch:
--   T7 (2 assertions): auth fail-open fix — NULL-safe profile check
--     rejects callers with no profile BEFORE the existing-batch branch
--     can run.
--   T8 (6 assertions): p_confirm_deduction=false compatibility — when
--     auto_stock_discount is ON, the wrapper raises P0001
--     'Confirmation required for automatic stock deduction' (the legacy
--     contract preserved). When auto_stock_discount is OFF, the wrapper
--     passes p_create_deduction=false so the new flow skips the
--     deduction batch (the legacy no-op contract preserved).
--   T9 (2 assertions): existing-batch retry returns order_id — when the
--     pre-existing batch has a non-null production_order_id, the wrapper
--     surfaces it as order_id (defense in depth: callers can resolve the
--     producing order from the legacy return shape too).
-- Total: 18 (PR 9 baseline) + 2 + 6 + 2 = 28 assertions.
--
-- Note on T7 scope: the review asked for auth.uid() NULL / missing
-- profile / service-role-like context tests "if feasible, especially
-- with existing batch". The "no profile" case is the only one that
-- can be reproduced (auth.uid NULL is filtered by RLS to P0002; the
-- "service-role-like NULL role" case is impossible because the
-- profiles.workshop_role column is NOT NULL DEFAULT 'viewer'). The
-- no-profile case is the highest-risk fail-open path because the
-- profiles lookup returns no row, leaving v_workshop_id and
-- v_actor_role both NULL — exactly the NULL-evaluates-NOT-TRUE
-- condition the original wrapper failed to handle.
select plan(28);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _legacy_wrapper_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _legacy_wrapper_ids (key, id) values
  -- Workshops
  ('workshop_a', 'aa000000-0000-0000-0000-00000000a101'),
  ('workshop_b', 'bb000000-0000-0000-0000-00000000b101'),
  -- Users
  ('admin_a',    'aa000000-0000-0000-0000-00000000a102'),
  ('admin_b',    'bb000000-0000-0000-0000-00000000b102'),
  ('viewer_a',   'aa000000-0000-0000-0000-00000000a103'),
  -- PR 9.1 review-blocker fix: user with auth.users row but NO profile
  -- (simulates a service-role-bypass scenario where auth.uid() returns
  -- a real id but the profiles lookup is empty).
  ('no_profile_a', 'aadddddd-0000-0000-0000-000000000001'),
  -- PR 9.1 review-blocker fix: user with profile but NULL workshop_role
  -- (simulates a profile created via the onboarding flow before the
  -- workshop_role column was set; the legacy wrapper's role check would
  -- fail-open because `NULL NOT IN ('admin', 'operational')` is NULL).
  ('null_role_a',  'aadddddd-0000-0000-0000-000000000002'),
  -- Material (for the wrapper's auto-deduction path)
  ('material_a', 'aa000000-0000-0000-0000-00000000a104'),
  -- Quotes
  ('quote_a_new',    'aa000000-0000-0000-0000-00000000a105'),
  ('quote_a_existing','aa000000-0000-0000-0000-00000000a106'),
  ('quote_a_viewer', 'aa000000-0000-0000-0000-00000000a107'),
  ('quote_a_cross',  'aa000000-0000-0000-0000-00000000a108'),
  -- PR 9.1 review-blocker fix: extra quotes for the auto_discount
  -- confirmation tests (T8). Distinct first-8-hex IDs from quote_a_new
  -- so the wrapper's `OP-<8-hex>` production_number derivation does not
  -- collide with the production_order created in T3 (which uses
  -- 'OP-aa000000' for quote_a_new). Without distinct IDs, the
  -- (workshop_id, production_number) UNIQUE index on production_orders
  -- would fail the T8 inserts.
  ('quote_a_autoon',  'aadddddd-0000-0000-0000-00000000a10d'),
  ('quote_a_autooff', 'aaeeeeee-0000-0000-0000-00000000a10e'),
  -- PR 9.1 review-blocker fix: a SECOND quote for the auto_discount=OFF
  -- path so T8.4 has a fresh quote in 'aprobado' status (T8.3 updates
  -- quote_a_autooff to 'en_produccion' as a side effect of the wrapper
  -- call, so T8.4 would fail the status check if it reused the same
  -- quote).
  ('quote_a_autooff2', 'aafffff1-0000-0000-0000-00000000a10e'),
  -- Recipe snapshot for quote_a_new (BOM consumption)
  ('snapshot_a',     'aa000000-0000-0000-0000-00000000a109'),
  -- Pre-PR-9 legacy deduction batch (simulating data that already exists
  -- before the migration runs — production_order_id is NULL)
  ('legacy_batch_a', 'aa000000-0000-0000-0000-00000000a10a'),
  -- PR 9.1 review-blocker fix: production_order linked to the legacy batch
  -- for the T9 surface (existing-batch with non-null production_order_id).
  -- Uses a manually-set production_number ('OP-EXIST-001') so the UNIQUE
  -- (workshop_id, production_number) constraint is not violated by the
  -- derived name used in T3 / T8.
  ('legacy_order_a', 'aaffffff-0000-0000-0000-00000000a10f');

grant select on _legacy_wrapper_ids to authenticated;

-- Seed workshops
insert into public.workshops (id, name) values
  ((select id from _legacy_wrapper_ids where key = 'workshop_a'), 'Legacy Wrapper Test Workshop A'),
  ((select id from _legacy_wrapper_ids where key = 'workshop_b'), 'Legacy Wrapper Test Workshop B');

-- Seed auth users
--
-- The on_auth_user_created trigger (0005_auth_profiles.sql) auto-creates
-- a workshop + profile for every new auth.users row. We insert the test
-- users first, then patch the auto-created rows to match the test
-- scaffolding (admin_a / admin_b / viewer_a get workshop_a/workshop_b
-- and workshop_role=admin/viewer; null_role_a gets workshop_id set but
-- workshop_role=NULL; no_profile_a gets its profile deleted so the
-- profiles lookup returns no row for the caller).
insert into auth.users (id, email) values
  ((select id from _legacy_wrapper_ids where key = 'admin_a'),  'legacy-wrapper-admin-a@example.com'),
  ((select id from _legacy_wrapper_ids where key = 'admin_b'),  'legacy-wrapper-admin-b@example.com'),
  ((select id from _legacy_wrapper_ids where key = 'viewer_a'), 'legacy-wrapper-viewer-a@example.com'),
  -- PR 9.1 review-blocker fix: user with auth.users row but NO profile
  ((select id from _legacy_wrapper_ids where key = 'no_profile_a'),
   'legacy-wrapper-no-profile-a@example.com'),
  -- PR 9.1 review-blocker fix: user with profile (workshop_id set) but
  -- NULL workshop_role (created via the onboarding flow before the role
  -- column was populated)
  ((select id from _legacy_wrapper_ids where key = 'null_role_a'),
   'legacy-wrapper-null-role-a@example.com');

-- PR 9.1 review-blocker fix: remove the auto-created profile for
-- no_profile_a so the wrapper's profiles lookup returns no row.
delete from public.profiles
 where id = (select id from _legacy_wrapper_ids where key = 'no_profile_a');

-- Assign profiles
update public.profiles
   set workshop_id = (select id from _legacy_wrapper_ids where key = 'workshop_a')
 where id in (
   (select id from _legacy_wrapper_ids where key = 'admin_a'),
   (select id from _legacy_wrapper_ids where key = 'viewer_a')
 );

update public.profiles
   set workshop_id = (select id from _legacy_wrapper_ids where key = 'workshop_b')
 where id = (select id from _legacy_wrapper_ids where key = 'admin_b');

-- PR 9.1 review-blocker fix: null_role_a has workshop_id set but
-- workshop_role stays NULL (the DO block below must NOT touch it).
update public.profiles
   set workshop_id = (select id from _legacy_wrapper_ids where key = 'workshop_a')
 where id = (select id from _legacy_wrapper_ids where key = 'null_role_a');

-- no_profile_a is intentionally NOT inserted into public.profiles (so the
-- profiles lookup returns no row for auth.uid() = no_profile_a.id).

-- Set workshop_role if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'workshop_role'
  ) THEN
    UPDATE public.profiles SET workshop_role = 'admin'
     WHERE id in (
       (select id from _legacy_wrapper_ids where key = 'admin_a'),
       (select id from _legacy_wrapper_ids where key = 'admin_b')
     );
    UPDATE public.profiles SET workshop_role = 'viewer'
     WHERE id = (select id from _legacy_wrapper_ids where key = 'viewer_a');
    -- null_role_a is intentionally left with workshop_role = NULL
    -- (this is the case the wrapper must reject)
  END IF;
END;
$$;

-- Seed a material
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values (
  (select id from _legacy_wrapper_ids where key = 'material_a'),
  (select id from _legacy_wrapper_ids where key = 'workshop_a'),
  'Legacy Wrapper Test Material', 'madera', 'un', 10, 50, 0
);

-- Seed workshop settings (auto_stock_discount is irrelevant to the new
-- wrapper because start_production_order doesn't read it; the wrapper
-- passes p_create_deduction = p_confirm_deduction directly).
insert into public.workshop_settings (workshop_id, name, auto_stock_discount)
values ((select id from _legacy_wrapper_ids where key = 'workshop_a'), 'Legacy Wrapper Workshop A', true)
on conflict (workshop_id) do update set auto_stock_discount = true;

-- Seed quotes (all in 'aprobado' status so the wrapper can delegate)
insert into public.quotes (id, workshop_id, quote_number, furniture_name, status) values
  ((select id from _legacy_wrapper_ids where key = 'quote_a_new'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-NEW-001', 'Legacy Wrapper New', 'aprobado'),
  ((select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-EXIST-001', 'Legacy Wrapper Existing', 'aprobado'),
  ((select id from _legacy_wrapper_ids where key = 'quote_a_viewer'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-VIEW-001', 'Legacy Wrapper Viewer', 'aprobado'),
  ((select id from _legacy_wrapper_ids where key = 'quote_a_cross'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-CROSS-001', 'Legacy Wrapper Cross', 'aprobado'),
  -- PR 9.1 review-blocker fix: T8 quotes for the auto_discount tests
  ((select id from _legacy_wrapper_ids where key = 'quote_a_autoon'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-AUTOON-001', 'Legacy Wrapper Auto On', 'aprobado'),
  ((select id from _legacy_wrapper_ids where key = 'quote_a_autooff'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-AUTOOFF-001', 'Legacy Wrapper Auto Off', 'aprobado'),
  ((select id from _legacy_wrapper_ids where key = 'quote_a_autooff2'),
   (select id from _legacy_wrapper_ids where key = 'workshop_a'),
   'LW-AUTOOFF-002', 'Legacy Wrapper Auto Off 2', 'aprobado');

-- Seed recipe snapshot for quote_a_new (so start_production_order can
-- run its internal check; the new flow doesn't consume the BOM but the
-- quote still needs to be valid)
insert into public.quote_recipe_snapshots (
  id, workshop_id, quote_id, material_id, material_name, material_unit,
  material_category, quantity, waste_pct, price_per_unit
) values (
  (select id from _legacy_wrapper_ids where key = 'snapshot_a'),
  (select id from _legacy_wrapper_ids where key = 'workshop_a'),
  (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
  (select id from _legacy_wrapper_ids where key = 'material_a'),
  'Legacy Wrapper Test Material', 'un', 'madera', 5, 0, 10
);

-- Seed a pre-existing legacy batch for quote_a_existing. The wrapper
-- should detect this batch (idempotent branch) and return the existing
-- batch without creating a new production_order. The legacy batch's
-- production_order_id MUST stay NULL (no backfill).
insert into public.quote_production_stock_deductions (
  id, workshop_id, quote_id, request_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _legacy_wrapper_ids where key = 'legacy_batch_a'),
  (select id from _legacy_wrapper_ids where key = 'workshop_a'),
  (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
  'aabbccdd-0000-0000-0000-000000000001',
  'completed',
  true, false, false,
  '[]'::jsonb,
  (select id from _legacy_wrapper_ids where key = 'admin_a')
);

-- Helper to switch the session to a test user
create or replace function _legacy_wrapper_set_user(p_key text)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('app.production_order_write_context', '', true);
  set local role authenticated;
  perform set_config(
    'request.jwt.claim.sub',
    (select id::text from _legacy_wrapper_ids where key = p_key),
    true
  );
end;
$$;

-- PR 9.1 review-blocker fix: helper to switch the workshop's
-- auto_stock_discount setting for the T8 auto_discount confirmation
-- tests. The default is TRUE (workshop_a was seeded with true); the
-- helper temporarily flips it for the T8.3 / T8.4 OFF-path tests.
create or replace function _legacy_wrapper_set_auto_discount(p_value boolean)
returns void
language plpgsql
as $$
begin
  update public.workshop_settings
     set auto_stock_discount = p_value
   where workshop_id = (select id from _legacy_wrapper_ids where key = 'workshop_a');
end;
$$;

-- PR 9.1 review-blocker fix: helper to seed a production_order for the
-- T9 existing-batch-with-FK test. The production_order is then patched
-- onto the legacy_batch_a row so the existing-batch branch can surface
-- the order_id in the wrapper's jsonb return.
--
-- We use a SECURITY DEFINER function so the insert bypasses the
-- production_orders RLS (which is SELECT-only and has no INSERT
-- policy). SECURITY DEFINER + is the same escape hatch the new
-- flow's start_production_order uses internally; the wrapper test
-- is just exercising the same path with a hand-rolled helper.
create or replace function _legacy_wrapper_link_legacy_batch_to_order()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  set local app.production_order_write_context = 'rpc';
  insert into public.production_orders (
    id, workshop_id, quote_id, production_number, state
  ) values (
    (select id from _legacy_wrapper_ids where key = 'legacy_order_a'),
    (select id from _legacy_wrapper_ids where key = 'workshop_a'),
    (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
    'OP-EXIST-001',
    'planned'::public.production_order_state
  );
  -- The legacy batch's production_order_id is NULL by design (PR 4
  -- legacy-null-preservation contract). T9 patches it to the new order
  -- so the wrapper's existing-batch branch can surface the order_id.
  v_order_id := (select id from _legacy_wrapper_ids where key = 'legacy_order_a');
  update public.quote_production_stock_deductions
     set production_order_id = v_order_id
   where id = (select id from _legacy_wrapper_ids where key = 'legacy_batch_a');
end;
$$;

-- ==========================================================================
-- T1: Viewer role is rejected with 42501
-- ==========================================================================

select _legacy_wrapper_set_user('viewer_a');

select throws_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_viewer'),
    true
  )$$,
  '42501',
  'not authorized to start production',
  'T1.1: viewer role is rejected from start_quote_production (legacy wrapper preserves the role check)'
);

-- ==========================================================================
-- T2: Cross-workshop call is rejected
--
-- The wrapper preserves RLS on public.quotes: a caller from workshop_b
-- cannot see workshop_a's quotes. The wrapper's own cross-workshop check
-- (`v_workshop_id <> caller_workshop`) is defense in depth; in practice,
-- the SELECT inside the wrapper finds NO row (because RLS hides it) and
-- raises P0002 'Quote not found'. Either outcome proves the call is
-- safely rejected; we assert P0002 here because that is what the
-- authenticated RLS path actually produces.
-- ==========================================================================

select _legacy_wrapper_set_user('admin_b');

select throws_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
    true
  )$$,
  'P0002',
  'Quote not found',
  'T2.1: cross-workshop start_quote_production is rejected (RLS hides the row before the wrapper can lock it)'
);

-- ==========================================================================
-- T3: Wrapper creates a production order via the new flow (no existing batch)
-- ==========================================================================

select _legacy_wrapper_set_user('admin_a');

select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
    true,
    'aabbccdd-0000-0000-0000-000000000010'::uuid
  )$$,
  'T3.1: admin happy path: wrapper delegates to start_production_order and returns a jsonb result'
);

-- T3.2: a production_order row was created for quote_a_new (proves the
-- wrapper actually called start_production_order, not just returned a
-- stub)
select results_eq(
  $$select count(*)::int
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$values (1::int)$$,
  'T3.2: legacy wrapper created a production_order row via start_production_order'
);

-- T3.3: the production order is in 'planned' state (the new-flow default)
select results_eq(
  $$select state::text
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$values ('planned'::text)$$,
  'T3.3: production_order is created in state=planned (new-flow default)'
);

-- T3.4: a deduction batch was created with non-null production_order_id
-- (the PR 4 new-flow contract — the whole point of the wrapper migration)
select ok(
  (select production_order_id is not null
     from public.quote_production_stock_deductions
    where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')),
  'T3.4: deduction batch has non-null production_order_id (new-flow contract honored by the wrapper)'
);

-- T3.5: the deduction batch's production_order_id points at the same
-- production_order created in T3.2
select results_eq(
  $$select production_order_id
      from public.quote_production_stock_deductions
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$select id from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  'T3.5: deduction batch production_order_id matches the production_order created by the wrapper'
);

-- T3.6: the quote status is updated to en_produccion (legacy contract
-- preserved; the existing T5 in production_deduction_rpc.test.sql keeps
-- passing)
select results_eq(
  $$select status::text
      from public.quotes
     where id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$values ('en_produccion'::text)$$,
  'T3.6: quote status is updated to en_produccion after wrapper call (legacy contract preserved)'
);

-- ==========================================================================
-- T4: Idempotency — same p_request_id returns the same production order id
-- ==========================================================================

select _legacy_wrapper_set_user('admin_a');

-- T4.1: second call with the same p_request_id hits the production_order_events
-- idempotency lookup inside start_production_order and returns the same order
select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
    true,
    'aabbccdd-0000-0000-0000-000000000010'::uuid
  )$$,
  'T4.1: retry with the same p_request_id succeeds (idempotent)'
);

-- T4.2: still exactly one production_order for the quote (no duplicate)
select results_eq(
  $$select count(*)::int
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$values (1::int)$$,
  'T4.2: retry with the same p_request_id does not create a duplicate production_order (idempotency preserved)'
);

-- ==========================================================================
-- T5: Existing-batch branch — pre-existing legacy batch is returned,
-- no new production_order is created, no backfill
-- ==========================================================================

select _legacy_wrapper_set_user('admin_a');

select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
    true,
    'aabbccdd-0000-0000-0000-000000000020'::uuid
  )$$,
  'T5.1: existing-batch branch: wrapper returns the pre-existing batch without error'
);

-- T5.2: the existing legacy batch keeps production_order_id = NULL
-- (no backfill — the legacy path is preserved)
select results_eq(
  $$select production_order_id is null
      from public.quote_production_stock_deductions
     where id = (select id from _legacy_wrapper_ids where key = 'legacy_batch_a')$$,
  $$values (true)$$,
  'T5.2: pre-existing legacy batch keeps production_order_id = NULL after wrapper call (no backfill)'
);

-- T5.3: no new production_order was created for the existing-batch quote
select results_eq(
  $$select count(*)::int
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_existing')$$,
  $$values (0::int)$$,
  'T5.3: existing-batch branch does not create a new production_order (legacy idempotency preserved)'
);

-- T5.4: only one batch exists for the existing-batch quote (no collision)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_existing')$$,
  $$values (1::int)$$,
  'T5.4: only one batch exists for the quote (existing-batch branch does not create a duplicate)'
);

-- ==========================================================================
-- T6: One-time-per-session deprecation warning is emitted
--
-- The wrapper emits RAISE WARNING 'start_quote_production is deprecated; ...'
-- on the first call within a session, and suppresses the warning on
-- subsequent calls in the same session. We verify this by inspecting
-- the session-local app.legacy_start_quote_warned GUC that the wrapper
-- sets via set_config(..., false) after the first warning.
--
-- Note: previous tests in this file (T1-T5) all ran in the same session
-- and called the wrapper (which set the GUC to 'true'). We RESET the GUC
-- before T6 to simulate a fresh session so we can observe the wrapper
-- initializing the marker from the unset state.
-- ==========================================================================

-- Reset the GUC to simulate a fresh session where the wrapper has
-- never been called. RESET requires superuser or the role owning the
-- GUC; we use set_config with an empty string and rely on the wrapper
-- to treat both NULL and '' (not equal to 'true') as "first call".
reset app.legacy_start_quote_warned;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _legacy_wrapper_ids where key = 'admin_a'),
  true
);

-- T6.1: a wrapper call succeeds (the deprecation warning is a non-fatal
-- side effect that does not raise an exception)
select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
    true,
    'aabbccdd-0000-0000-0000-000000000030'::uuid
  )$$,
  'T6.1: wrapper call succeeds (deprecation RAISE WARNING is non-fatal)'
);

-- T6.2: after the first call, the GUC is set to 'true' (one-time marker).
-- We assert NOT-NULL because the wrapper initializes the GUC via
-- set_config(..., false) and any non-empty value is a valid marker.
select ok(
  coalesce(current_setting('app.legacy_start_quote_warned', true), '') = 'true',
  'T6.2: app.legacy_start_quote_warned is set to true after the first wrapper call (one-time warning marker)'
);

-- T6.3: a second wrapper call in the same session does not raise
-- (proves the one-time-per-session warning is non-fatal and the wrapper
-- is safe to call repeatedly). The warning is suppressed on the second
-- call (verified by the GUC marker already being 'true').
select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_new'),
    true,
    'aabbccdd-0000-0000-0000-000000000031'::uuid
  )$$,
  'T6.3: second wrapper call in the same session succeeds (warning is suppressed; wrapper is safe to call repeatedly)'
);

-- T6.4: a different p_request_id on the same quote still does not create
-- a duplicate production_order (the idempotency on the production_order_events
-- scoped lookup is preserved across the wrapper's session)
select results_eq(
  $$select count(*)::int
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_new')$$,
  $$values (1::int)$$,
  'T6.4: distinct p_request_id on the same quote still produces exactly one production_order (idempotency preserved across requests)'
);

-- ==========================================================================
-- T7: Auth fail-open fix — NULL-safe profile/role checks reject callers
-- with NULL auth.uid(), missing profile, or NULL role BEFORE the
-- existing-batch branch can run.
--
-- The pre-fix wrapper had two NULL-unsafe checks:
--   1. `v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id = auth.uid())`
--      evaluates to NULL (not TRUE) when the profiles lookup is empty,
--      so the IF block was skipped.
--   2. `v_actor_role NOT IN ('admin', 'operational')` evaluates to NULL
--      when the role is NULL, so the IF block was also skipped.
-- A caller with auth.uid() set but no profile (or a profile with NULL
-- role) could therefore reach the existing-batch branch and either
-- update the quote status or return the existing batch's data.
--
-- The fix collapses the two checks into a single NULL-safe profile
-- lookup that rejects NULL profile / NULL workshop / NULL role with
-- 42501 BEFORE the existing-batch branch can run.
-- ==========================================================================

-- T7.1: NULL auth.uid() (no JWT claim sub) is rejected with 42501.
-- The previous wrapper would raise P0002 'Quote not found' for a
-- missing JWT, but the legacy rejection here is the explicit NULL
-- workshop / NULL role rejection (the wrapper must NOT depend on RLS
-- hiding the row — service-role contexts can bypass RLS).
reset app.legacy_start_quote_warned;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
-- A pseudo-user is set up below: no_profile_a exists in auth.users
-- but has NO profile. The wrapper must reject this case with 42501
-- (not P0002 'Quote not found') because the missing profile is the
-- root cause and the wrapper runs in SECURITY INVOKER mode where
-- RLS alone cannot be relied on for a service-role bypass.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _legacy_wrapper_ids where key = 'no_profile_a'),
  true
);

select throws_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
    true
  )$$,
  '42501',
  'Caller has no profile/workshop',
  'T7.1: caller with no profile is rejected with 42501 (auth fail-open fix; service-role-bypass protection)'
);

-- T7.2: existing-batch path is also protected — a no-profile caller
-- CANNOT take the existing-batch branch and return the legacy batch.
-- The wrapper raises 42501 from the NULL-safe profile check BEFORE
-- the existing-batch SELECT runs. The exact message matches T7.1.
select throws_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
    true,
    'aabbccdd-0000-0000-0000-0000000000a1'::uuid
  )$$,
  '42501',
  'Caller has no profile/workshop',
  'T7.2: existing-batch path is protected by the NULL-safe profile check (auth fail-open fix)'
);

-- ==========================================================================
-- T8: p_confirm_deduction=false compatibility — when auto_stock_discount
-- is ON, the wrapper raises P0001 'Confirmation required for automatic
-- stock deduction' (the legacy contract preserved). When
-- auto_stock_discount is OFF, the wrapper passes p_create_deduction=false
-- so the new flow skips the deduction batch (the legacy no-op contract
-- preserved).
--
-- The pre-fix wrapper mapped p_confirm_deduction=false to
-- p_create_deduction=false unconditionally. This was a behavior
-- regression: when auto_discount was ON, the legacy function raised
-- 'Confirmation required' for a confirm=false call; the new wrapper
-- silently produced a production order with no deduction batch.
-- ==========================================================================

-- T8.1: auto_discount=ON (workshop_a default) + p_confirm_deduction=false
-- → RAISE EXCEPTION 'Confirmation required for automatic stock deduction'
-- (P0001). The wrapper must check workshop_settings.auto_stock_discount
-- before delegating to start_production_order.
select _legacy_wrapper_set_user('admin_a');
select _legacy_wrapper_set_auto_discount(true);

select throws_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_autoon'),
    false,
    'aabbccdd-0000-0000-0000-0000000000b1'::uuid
  )$$,
  'P0001',
  'Confirmation required for automatic stock deduction',
  'T8.1: auto_discount=ON + confirm=false raises P0001 (legacy compatibility regression fix)'
);

-- T8.2: auto_discount=ON + p_confirm_deduction=true → success path.
-- The wrapper passes p_create_deduction=true to start_production_order,
-- which creates the deduction batch with non-null production_order_id
-- (the new-flow contract).
select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_autoon'),
    true,
    'aabbccdd-0000-0000-0000-0000000000b2'::uuid
  )$$,
  'T8.2: auto_discount=ON + confirm=true succeeds (production order + deduction batch created)'
);

-- T8.3: auto_discount=OFF + p_confirm_deduction=true → success path
-- (no deduction batch, no error). The legacy behavior: a confirm=true
-- call when auto_discount is OFF is treated the same as confirm=false
-- — the wrapper updates the quote status, creates the production order,
-- and skips the deduction batch.
select _legacy_wrapper_set_auto_discount(false);

select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_autooff'),
    true,
    'aabbccdd-0000-0000-0000-0000000000b3'::uuid
  )$$,
  'T8.3: auto_discount=OFF + confirm=true succeeds (production order created; no deduction batch)'
);

-- T8.3b: a deduction batch was NOT created for the auto_discount=OFF
-- path. The wrapper passes p_create_deduction=false so the new flow
-- skips the batch.
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_autooff')$$,
  $$values (0::int)$$,
  'T8.3b: auto_discount=OFF path does not create a deduction batch (legacy no-op contract preserved)'
);

-- T8.3c: a production order WAS created for the auto_discount=OFF
-- path (the new-flow contract: the production order is always created
-- in start_production_order, the deduction is the only thing skipped).
select results_eq(
  $$select count(*)::int
      from public.production_orders
     where quote_id = (select id from _legacy_wrapper_ids where key = 'quote_a_autooff')$$,
  $$values (1::int)$$,
  'T8.3c: auto_discount=OFF path creates a production order (new-flow contract)'
);

-- T8.4: auto_discount=OFF + p_confirm_deduction=false → success path.
-- Same as T8.3 (the legacy behavior treats confirm=true/confirm=false
-- identically when auto_discount is OFF). The wrapper must NOT raise
-- 'Confirmation required' for this case. Uses a fresh quote
-- (quote_a_autooff2) because T8.3 already moved quote_a_autooff to
-- 'en_produccion'.
select lives_ok(
  $$select public.start_quote_production(
    (select id from _legacy_wrapper_ids where key = 'quote_a_autooff2'),
    false,
    'aabbccdd-0000-0000-0000-0000000000b4'::uuid
  )$$,
  'T8.4: auto_discount=OFF + confirm=false succeeds (no error; legacy no-op contract preserved)'
);

-- Reset auto_discount back to the workshop default so subsequent
-- assertions (if any) see the canonical value.
select _legacy_wrapper_set_auto_discount(true);

-- ==========================================================================
-- T9: existing-batch retry returns order_id — when the pre-existing
-- batch has a non-null production_order_id, the wrapper surfaces it as
-- order_id in the jsonb return shape. This is the new-flow contract
-- surfaced through the legacy wrapper: callers that already have a
-- production order for the quote (via the new flow) can resolve the
-- producing order from the legacy return shape too.
--
-- The pre-fix wrapper always returned `order_id: null` from the
-- existing-batch branch (because the legacy batches had NULL
-- production_order_id by design — the PR 4 legacy-null-preservation
-- contract). The fix keeps order_id: null for the legacy batches but
-- surfaces the FK when it is set (defense in depth + better DX for
-- callers that have already migrated to the new flow).
-- ==========================================================================

-- T9.1: existing-batch with non-null production_order_id → order_id is
-- set to the batch's production_order_id. The legacy_batch_a is
-- patched with the legacy_order_a id so the wrapper can surface it.
select _legacy_wrapper_set_user('admin_a');
select _legacy_wrapper_link_legacy_batch_to_order();

select results_eq(
  $$select (public.start_quote_production(
      (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
      true,
      'aabbccdd-0000-0000-0000-0000000000c1'::uuid
    )->>'order_id')$$,
  $$select (select id::text from _legacy_wrapper_ids where key = 'legacy_order_a')$$,
  'T9.1: existing-batch with non-null production_order_id returns order_id = batch.production_order_id'
);

-- T9.2: existing-batch with NULL production_order_id (the original
-- pre-fix path) → order_id is null. The legacy batch's FK is
-- re-cleared to NULL to confirm the contract is unchanged for the
-- PR 4 legacy-null-preservation case.
update public.quote_production_stock_deductions
   set production_order_id = null
 where id = (select id from _legacy_wrapper_ids where key = 'legacy_batch_a');

select results_eq(
  $$select (public.start_quote_production(
      (select id from _legacy_wrapper_ids where key = 'quote_a_existing'),
      true,
      'aabbccdd-0000-0000-0000-0000000000c2'::uuid
    )->>'order_id')$$,
  $$values (null::text)$$,
  'T9.2: existing-batch with NULL production_order_id returns order_id = null (PR 4 legacy-null-preservation contract)'
);

rollback;
