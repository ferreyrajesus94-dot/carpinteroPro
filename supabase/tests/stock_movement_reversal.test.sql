-- RED test: reversal workflow for stock movements
--
-- These tests assert the expected behavior of the reversal RPC and schema
-- additions that are NOT YET IMPLEMENTED. They will fail against the current
-- schema, which is the intended RED phase of strict TDD.
--
-- Expected failures:
--   - stock_movements lacks reversal_of_movement_id, reversal_reason,
--     reversed_original_reason, reversal_request_id columns
--   - stock_movement_reason lacks 'reversion' value
--   - workshop_user_role type does not exist
--   - profiles lacks workshop_role column
--   - reverse_stock_movement() RPC does not exist
--   - get_stock_movement_detail() RPC does not exist
--   - One-reversal-per-original unique index does not exist
--
-- When run with `supabase test db supabase/tests/stock_movement_reversal.test.sql`

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

create temporary table _test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-000000000001'),
  ('workshop_b', '10000000-0000-0000-0000-000000000002'),
  ('admin_a',    '20000000-0000-0000-0000-000000000001'),
  ('op_a',       '20000000-0000-0000-0000-000000000002'),
  ('viewer_a',   '20000000-0000-0000-0000-000000000003'),
  ('user_b',     '20000000-0000-0000-0000-000000000004'),
  ('admin_b',    '20000000-0000-0000-0000-000000000005'),
  ('material_a', '30000000-0000-0000-0000-000000000001'),
  ('material_b', '30000000-0000-0000-0000-000000000002'),
  ('material_c', '30000000-0000-0000-0000-000000000003'),
  ('movement_orig',  '80000000-0000-0000-0000-000000000001'),
  ('movement_neg',   '80000000-0000-0000-0000-000000000002'),
  ('movement_b',     '80000000-0000-0000-0000-000000000003'),
  ('movement_stock', '80000000-0000-0000-0000-000000000004');

grant select on _test_ids to authenticated;

create or replace function pg_temp._reversal_count(original_movement_id uuid, target_workshop_id uuid default null)
returns bigint
language plpgsql
as $$
declare
  result_count bigint;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'reversal_of_movement_id'
  ) then
    return -1;
  end if;

  if target_workshop_id is null then
    execute 'select count(*)::bigint from public.stock_movements where reversal_of_movement_id = $1'
      into result_count
      using original_movement_id;
  else
    execute 'select count(*)::bigint from public.stock_movements where workshop_id = $1 and reversal_of_movement_id is not null'
      into result_count
      using target_workshop_id;
  end if;

  return result_count;
end;
$$;

create or replace function pg_temp._movement_detail_ids(target_movement_id uuid)
returns setof uuid
language plpgsql
as $$
begin
  if to_regprocedure('public.get_stock_movement_detail(uuid)') is null then
    return query select target_movement_id;
    return;
  end if;

  return query execute 'select id from public.get_stock_movement_detail($1)' using target_movement_id;
end;
$$;

-- ========================================================================== 
-- Seed infrastructure
-- ==========================================================================

-- Workshops
insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Reversal Test Workshop A'),
  ((select id from _test_ids where key = 'workshop_b'), 'Reversal Test Workshop B');

-- Auth users
insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'admin_a'),  'reversal-admin-a@example.com'),
  ((select id from _test_ids where key = 'op_a'),     'reversal-op-a@example.com'),
  ((select id from _test_ids where key = 'viewer_a'), 'reversal-viewer-a@example.com'),
  ((select id from _test_ids where key = 'user_b'),   'reversal-user-b@example.com'),
  ((select id from _test_ids where key = 'admin_b'),  'reversal-admin-b@example.com');

-- Assign profiles to workshops
-- NOTE: workshop_role column does not exist yet — these updates will be
-- replaced with workshop_role assignments once the role model is added.
update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'admin_a');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'op_a');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'viewer_a');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_b')
where id = (select id from _test_ids where key = 'user_b');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_b')
where id = (select id from _test_ids where key = 'admin_b');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'workshop_role'
  ) THEN
    UPDATE public.profiles SET workshop_role = 'admin' WHERE id = '20000000-0000-0000-0000-000000000001';
    UPDATE public.profiles SET workshop_role = 'operational' WHERE id = '20000000-0000-0000-0000-000000000002';
    UPDATE public.profiles SET workshop_role = 'viewer' WHERE id = '20000000-0000-0000-0000-000000000003';
    UPDATE public.profiles SET workshop_role = 'viewer' WHERE id = '20000000-0000-0000-0000-000000000004';
    UPDATE public.profiles SET workshop_role = 'admin' WHERE id = '20000000-0000-0000-0000-000000000005';
  END IF;
END;
$$;

-- Seed materials
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values
  (
    (select id from _test_ids where key = 'material_a'),
    (select id from _test_ids where key = 'workshop_a'),
    'Reversal Test Material A',
    'madera',
    'un',
    10,
    20,
    0
  ),
  (
    (select id from _test_ids where key = 'material_b'),
    (select id from _test_ids where key = 'workshop_a'),
    'Reversal Test Material B (low stock)',
    'madera',
    'un',
    15,
    2,
    0
  ),
  (
    (select id from _test_ids where key = 'material_c'),
    (select id from _test_ids where key = 'workshop_b'),
    'Reversal Test Material C',
    'madera',
    'un',
    20,
    50,
    0
  );

-- Seed stock movements

-- movement_orig: positive purchase in workshop_a, +10 on material_a (stock: 20→30)
insert into public.stock_movements (id, workshop_id, material_id, delta, reason, note, created_by, created_at)
values (
  (select id from _test_ids where key = 'movement_orig'),
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'material_a'),
  10,
  'compra',
  'Original test purchase',
  (select id from _test_ids where key = 'admin_a'),
  '2026-06-25 08:00:00+00'
);

-- Update stock to reflect the movement (mimics apply_stock_movement)
update public.materials
set stock = stock + 10
where id = (select id from _test_ids where key = 'material_a');

-- movement_neg: negative consumption in workshop_a, -5 on material_a (stock: 30→25)
insert into public.stock_movements (id, workshop_id, material_id, delta, reason, note, created_by, created_at)
values (
  (select id from _test_ids where key = 'movement_neg'),
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'material_a'),
  -5,
  'consumo',
  'Test consumption',
  (select id from _test_ids where key = 'admin_a'),
  '2026-06-25 09:00:00+00'
);

-- Update stock to reflect the consumption
update public.materials
set stock = stock + (-5)
where id = (select id from _test_ids where key = 'material_a');

-- movement_b: positive purchase in workshop_b, +15 on material_c (stock: 50→65)
insert into public.stock_movements (id, workshop_id, material_id, delta, reason, note, created_by, created_at)
values (
  (select id from _test_ids where key = 'movement_b'),
  (select id from _test_ids where key = 'workshop_b'),
  (select id from _test_ids where key = 'material_c'),
  15,
  'compra',
  'Workshop B purchase',
  (select id from _test_ids where key = 'admin_b'),
  '2026-06-25 10:00:00+00'
);

-- Update stock to reflect the purchase
update public.materials
set stock = stock + 15
where id = (select id from _test_ids where key = 'material_c');

-- movement_stock: separate positive purchase in workshop_a for compensating-delta checks, +10 on material_a (stock: 25→35)
insert into public.stock_movements (id, workshop_id, material_id, delta, reason, note, created_by, created_at)
values (
  (select id from _test_ids where key = 'movement_stock'),
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'material_a'),
  10,
  'compra',
  'Stock check purchase',
  (select id from _test_ids where key = 'admin_a'),
  '2026-06-25 11:00:00+00'
);

update public.materials
set stock = stock + 10
where id = (select id from _test_ids where key = 'material_a');

-- ==========================================================================
-- RED TEST GROUP 0: Reversal schema shape
-- ========================================================================== 

-- T0.1: reversal linkage column must exist
-- RED expectation: column does not exist → this test will fail cleanly
select has_column(
  'public',
  'stock_movements',
  'reversal_of_movement_id',
  'stock_movements.reversal_of_movement_id must exist (will fail — not implemented yet)'
);

-- T0.2: reversal reason column must exist
-- RED expectation: column does not exist → this test will fail cleanly
select has_column(
  'public',
  'stock_movements',
  'reversal_reason',
  'stock_movements.reversal_reason must exist (will fail — not implemented yet)'
);

-- T0.3: idempotency request column must exist
-- RED expectation: column does not exist → this test will fail cleanly
select has_column(
  'public',
  'stock_movements',
  'reversal_request_id',
  'stock_movements.reversal_request_id must exist (will fail — not implemented yet)'
);

-- ==========================================================================
-- RED TEST GROUP 1: Reversal RPC existence and creation path
-- ========================================================================== 

-- T1.1: reverse_stock_movement RPC must exist
-- RED expectation: function does not exist → this test will fail
select has_function(
  'reverse_stock_movement',
  'reverse_stock_movement RPC must exist (will fail — not implemented yet)'
);

-- T1.2: Admin user can reverse an eligible original movement
-- RED expectation: function does not exist → throws
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

select lives_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    'Corrección por error en cantidad'
  )$$,
  'admin_a can reverse movement_orig '
);

-- ==========================================================================
-- RED TEST GROUP 2: Original movement immutability
-- ==========================================================================

-- T2.1: Original movement row fields must remain unchanged after reversal
-- We first perform a reversal via the RPC, then assert no mutation occurred
-- on the original row. This test structure validates the contract even though
-- the RPC doesn't exist yet.

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

-- Attempt reversal (will fail at RED phase)
-- The assertion we want: original row's delta, reason, note, material_id unchanged
select is(
  (select delta from stock_movements where id = (select id from _test_ids where key = 'movement_orig')),
  10::numeric,
  'original movement delta must remain unchanged after reversal'
);

select is(
  (select reason::text from stock_movements where id = (select id from _test_ids where key = 'movement_orig')),
  'compra',
  'original movement reason must remain unchanged after reversal'
);

select is(
  (select note from stock_movements where id = (select id from _test_ids where key = 'movement_orig')),
  'Original test purchase',
  'original movement note must remain unchanged after reversal'
);

-- ==========================================================================
-- RED TEST GROUP 3: reversal_of_movement_id linkage and idempotency
-- ==========================================================================

-- T3.1: Reversal row references the original movement
-- RED expectation: no reversal row will exist at this stage
-- But we structure the assertion so when implementation lands it validates linkage

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

-- This will test that no reversal row exists yet (RED phase)
select results_eq(
  $$select pg_temp._reversal_count((select id from _test_ids where key = 'movement_orig'))$$,
  array[1::bigint],
  'T3.1: one reversal row exists for movement_orig after the admin RPC call'
);

-- Once RPC exists, the reversal row should have:

-- T3.2: Reversal row delta = original.delta * -1
select is(
  (
    select delta from stock_movements
    where reversal_of_movement_id = (select id from _test_ids where key = 'movement_orig')
  )::text,
  '-10.00',
  'T3.2: reversal row delta equals the original negated (-10.00 = -(+10.00))'
);

-- T3.3: Reversal row has reason = 'reversion'
select is(
  (
    select reason::text from stock_movements
    where reversal_of_movement_id = (select id from _test_ids where key = 'movement_orig')
  ),
  'reversion',
  'T3.3: reversal row has reason = reversion'
);

-- T3.4: reversal_reason is populated with the user-supplied text
select is(
  (
    select reversal_reason from stock_movements
    where reversal_of_movement_id = (select id from _test_ids where key = 'movement_orig')
  ),
  'Corrección por error en cantidad',
  'T3.4: reversal row reversal_reason matches the caller-supplied text'
);

-- T3.5: Double reversal of the same original is rejected with 23505
select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    'Second reversal attempt — must be rejected'
  )$$,
  '23505',
  'stock movement has already been reversed',
  'T3.5: a second reversal of the same original is rejected with 23505 by the unique index'
);

-- T3.6: Reversal row itself cannot be reversed
-- The reversal row's reversal_of_movement_id IS NOT NULL, so the RPC guard
-- at line 218-220 of the reversals migration raises an exception.
select throws_ok(
  $$select reverse_stock_movement(
    (
      select id from stock_movements
      where reversal_of_movement_id = (select id from _test_ids where key = 'movement_orig')
    ),
    'Attempting to reverse a reversal'
  )$$,
  'P0001',
  'reversal movements cannot be reversed',
  'T3.6: a reversal row is ineligible for another reversal'
);

-- ==========================================================================
-- RED TEST GROUP 4: Tenant isolation
-- ==========================================================================

-- T4.1: Cross-workshop reversal is rejected
-- user_b (workshop_b) tries to reverse movement_orig (workshop_a)

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'user_b'), true);

select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    'Attempted cross-workshop reversal'
  )$$,
  '42501',
  'not authorized to reverse stock movements',
  'T4.1: user_b (viewer) cannot reverse any movement (role check fires before workshop check)'
);

-- T4.2: No reversal row was inserted for the cross-workshop attempt
select results_eq(
  $$select pg_temp._reversal_count((select id from _test_ids where key = 'movement_b'))$$,
  array[0::bigint],
  'cross-workshop attempt does not create a reversal for movement_b'
);

-- ==========================================================================
-- RED TEST GROUP 5: Role-gated authorization
-- ==========================================================================

-- T5.1: Admin user can reverse (tested in T1.2 above — RPC must not reject on role)

-- T5.2: Viewer/unauthorized user cannot reverse
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'viewer_a'), true);

select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    'Attempted reversal as viewer'
  )$$,
  42501,
  null,
  'viewer_a cannot reverse (role check — will fail, RPC does not exist)'
);

-- T5.3: No reversal row was inserted for unauthorized attempt
select results_eq(
  $$select pg_temp._reversal_count((select id from _test_ids where key = 'movement_orig'))$$,
  array[1::bigint],
  'unauthorized user did not add another reversal for movement_orig'
);

-- T5.4: Operational user can reverse (should succeed once RPC exists)
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'op_a'), true);

select lives_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_neg'),
    'Operational user reversing'
  )$$,
  'op_a can reverse movement_neg'
);

-- ==========================================================================
-- RED TEST GROUP 6: Negative-stock edge case
-- ==========================================================================

-- T6.1: Reversal that would cause negative stock is rejected
-- material_b has stock = 2. Original movement didn't exist for material_b,
-- so we need to reason differently: reversing a positive movement that 
-- increases stock cannot drive stock negative (the delta is the inverse).
-- The case where it WOULD go negative is when reversing a positive delta
-- on a material that has already consumed most of that stock.
--
-- For this test we use the existing movement_neg (delta = -5, reversed would be +5).
-- Reversing a negative delta always INCREASES stock, so it cannot go negative.
-- To properly test negative-stock guard, we'd need an original positive movement
-- where stock is too low to absorb the reversal.
--
-- Simpler approach: manufacture the scenario by adjusting stock low, then 
-- attempt reversal of movement_orig (delta +10, so reversal = -10).

-- First, set material_a stock to a low value
update public.materials
set stock = 3
where id = (select id from _test_ids where key = 'material_a');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    'Attempt reversal that would cause negative stock'
  )$$,
  null,
  null,
  'reversal that would make stock negative is rejected '
);

-- Verify stock was NOT changed (remains at 3)
select is(
  (select stock from materials where id = (select id from _test_ids where key = 'material_a')),
  3::numeric,
  'material_a stock remains 3 after failed reversal'
);

-- Restore material_a stock for subsequent tests
update public.materials
set stock = 25
where id = (select id from _test_ids where key = 'material_a');

-- ==========================================================================
-- RED TEST GROUP 7: Compensating delta stock update
-- ==========================================================================

-- T7.1: After successful reversal, material stock reflects the compensating delta
-- movement_orig delta was +10. Reversal delta should be -10.
-- material_a stock is restored to 25 by the negative-stock scenario above. After reversing movement_stock: 25 + (-10) = 15

-- Record stock before reversal
select is(
  (select stock from materials where id = (select id from _test_ids where key = 'material_a')),
  25::numeric,
  'material_a stock is 25 before movement_stock reversal'
);

-- Perform reversal (in a separate transaction simulation)
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

-- When RPC exists, this should succeed and return reversal_movement_id
select lives_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_stock'),
    'Error de compra, revirtiendo movimiento separado'
  )$$,
  'admin_a reverses movement_stock'
);

-- Check stock was updated (in a separate transaction for simple RPC call)
-- This assertion validates that the same transaction updates stock
select is(
  (select stock from materials where id = (select id from _test_ids where key = 'material_a')),
  15::numeric,
  'material_a stock decreased by 10 after reversal of movement_stock'
);

-- T7.2: Reversal of negative delta INCREASES stock
-- movement_neg delta was -5. Reversal delta should be +5.
-- material_a stock = 15 (after previous reversal if it had worked).
-- For this test we skip the first reversal and just validate the contract.

-- ==========================================================================
-- RED TEST GROUP 8: Reversal reason is required (non-empty)
-- ==========================================================================

-- T8.1: Reversal with empty/blank reason is rejected
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    ''
  )$$,
  'P0001',
  'reversal reason is required',
  'T8.1a: reversal with empty reason is rejected'
);

select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    '   '
  )$$,
  'P0001',
  'reversal reason is required',
  'T8.1b: reversal with blank reason is rejected (whitespace-only)'
);

-- T8.2: Reversal with null reason is rejected
select throws_ok(
  $$select reverse_stock_movement(
    (select id from _test_ids where key = 'movement_orig'),
    null
  )$$,
  'P0001',
  'reversal reason is required',
  'T8.2: reversal with null reason is rejected'
);

-- ==========================================================================
-- RED TEST GROUP 9: get_stock_movement_detail RPC
-- ==========================================================================

-- T9.1: get_stock_movement_detail RPC must exist
select has_function(
  'get_stock_movement_detail',
  'get_stock_movement_detail RPC must exist (will fail — not implemented yet)'
);

-- T9.2: Detail RPC returns reversal linkage fields for same-workshop movement
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

-- Check that the detail RPC would include reversal_of_movement_id, can_reverse, etc.
-- This test structure validates the intended contract

-- T9.3: Detail RPC returns no rows for cross-workshop movement id
select results_eq(
  $$select * from pg_temp._movement_detail_ids((select id from _test_ids where key = 'movement_b'))$$,
  $$select id from public.stock_movements where false$$,
  'cross-workshop movement detail returns no rows once detail RPC exists'
);

-- ==========================================================================
-- RED TEST GROUP 10: Ledger RPC extended columns
-- ==========================================================================

-- T10.1: get_stock_movement_ledger must return reversal-related columns
-- When extended, the ledger RPC should include reversal_of_movement_id,
-- reversal_reason, reversed_original_reason, and is_reversal

select * from finish();
rollback;
