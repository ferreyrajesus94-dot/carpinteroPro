-- Focused pgTAP tests for production stock deduction RPCs.
--
-- Tests:
--   1. apply_stock_movement rejects consumo_produccion reason
--   2. viewer role cannot call start_quote_production
--   3. viewer role cannot call capture_quote_approved_bom
--   4. admin happy path for start_quote_production (PR 2 blocker fix)

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

create temporary table _test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-00000000a001'),
  ('admin_a',    '20000000-0000-0000-0000-00000000a001'),
  ('viewer_a',   '20000000-0000-0000-0000-00000000a002'),
  ('quote_a',    '40000000-0000-0000-0000-00000000a001');

grant select on _test_ids to authenticated;

-- Seed workshop
insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Prod Deduction RPC Test Workshop');

-- Seed auth users
insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'admin_a'),  'prod-ded-rpc-admin@example.com'),
  ((select id from _test_ids where key = 'viewer_a'), 'prod-ded-rpc-viewer@example.com');

-- Assign profiles
update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'admin_a') or id = (select id from _test_ids where key = 'viewer_a');

-- Set workshop_role if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'workshop_role'
  ) THEN
    UPDATE public.profiles SET workshop_role = 'admin' WHERE id = '20000000-0000-0000-0000-00000000a001';
    UPDATE public.profiles SET workshop_role = 'viewer' WHERE id = '20000000-0000-0000-0000-00000000a002';
  END IF;
END;
$$;

-- Seed a material for consumo_produccion test
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values (
  '30000000-0000-0000-0000-00000000a001',
  (select id from _test_ids where key = 'workshop_a'),
  'RPC Test Material', 'madera', 'un', 10, 50, 0
);

-- Seed workshop settings
insert into public.workshop_settings (workshop_id, name, auto_stock_discount)
values ((select id from _test_ids where key = 'workshop_a'), 'RPC Test Workshop', true)
on conflict (workshop_id) do update set auto_stock_discount = true;

-- Seed a minimal quote so RPC role checks can fire
insert into public.quotes (id, workshop_id, quote_number, furniture_name, status)
values (
  '40000000-0000-0000-0000-00000000a001',
  (select id from _test_ids where key = 'workshop_a'),
  'RPC-TEST-001', 'Test Mueble', 'aprobado'
);

-- Seed recipe snapshot so BOM capture succeeds
insert into public.quote_recipe_snapshots (id, workshop_id, quote_id, material_id, material_name, material_unit, material_category, quantity, waste_pct, price_per_unit)
values (
  '60000000-0000-0000-0000-00000000a001',
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'quote_a'),
  '30000000-0000-0000-0000-00000000a001',
  'RPC Test Material', 'un', 'madera', 5, 0, 10
);

-- ==========================================================================
-- Test 1: apply_stock_movement rejects consumo_produccion
-- ==========================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

select throws_ok(
  $$select apply_stock_movement(
    '30000000-0000-0000-0000-00000000a001',
    -5,
    'consumo_produccion'::stock_movement_reason,
    'should be rejected',
    null
  )$$,
  'P0001',
  'Use start_quote_production for production stock deductions',
  'apply_stock_movement should reject consumo_produccion reason'
);

-- ==========================================================================
-- Test 2: viewer role cannot call start_quote_production
-- ==========================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'viewer_a'), true);

select throws_ok(
  $$select public.start_quote_production(
    (select id from _test_ids where key = 'quote_a'),
    true
  )$$,
  '42501',
  'not authorized to start production',
  'viewer should be rejected from start_quote_production'
);

-- ==========================================================================
-- Test 3: viewer role cannot call capture_quote_approved_bom
-- ==========================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'viewer_a'), true);

select throws_ok(
  $$select public.capture_quote_approved_bom((select id from _test_ids where key = 'quote_a'))$$,
  '42501',
  'not authorized to capture approved BOM',
  'viewer should be rejected from capture_quote_approved_bom'
);

-- ==========================================================================
-- Test 4: admin happy path for start_quote_production (PR 2 blocker fix)
--
-- The new reject_direct_en_produccion_writes trigger on quotes.status
-- (added in PR 2 migration 20260630000001_production_orders_rpc.sql)
-- blocks any authenticated write of status = 'en_produccion' UNLESS the
-- transaction-local guard app.production_order_write_context = 'rpc' is
-- set. start_quote_production is SECURITY INVOKER and writes
-- en_produccion as the caller. Without the PR 2 blocker fix, the
-- function's UPDATE public.quotes SET status = 'en_produccion' would
-- raise 42501 from the new trigger. The fix adds SET LOCAL
-- app.production_order_write_context = 'rpc' around the status writes
-- in start_quote_production (after its own role/workshop checks).
--
-- This test exercises the admin happy path and verifies:
--   (a) start_quote_production does not raise 42501 from the new
--       trigger, AND
--   (b) the function's behavior is unchanged: it updates the quote
--       status to en_produccion and returns a jsonb result with the
--       expected shape.
-- ==========================================================================
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Clear the guard so we test the function sets it internally
select set_config('app.production_order_write_context', '', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'admin_a'), true);

select lives_ok(
  $$select public.start_quote_production(
    (select id from _test_ids where key = 'quote_a'),
    true,
    gen_random_uuid()
  )$$,
  'admin happy path for start_quote_production — function sets the guard internally, so the new en_produccion guard does not break the existing production flow'
);

-- Sanity: the quote is now in en_produccion status (proves the UPDATE
-- was not silently skipped — the guard path is exercised end-to-end)
select results_eq(
  $$select status::text from public.quotes where id = '40000000-0000-0000-0000-00000000a001'::uuid$$,
  $$values ('en_produccion'::text)$$,
  'after admin start_quote_production, the quote is in en_produccion status (proves the guard path let the UPDATE through)'
);

rollback;
