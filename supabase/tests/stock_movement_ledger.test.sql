-- RED test: assert get_stock_movement_ledger behavior
-- Expected to fail against current migrations (function does not exist)

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

create temporary table _test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-000000000001'),
  ('workshop_b', '10000000-0000-0000-0000-000000000002'),
  ('user_a',     '20000000-0000-0000-0000-000000000001'),
  ('user_b',     '20000000-0000-0000-0000-000000000002'),
  ('material_a', '30000000-0000-0000-0000-000000000001'),
  ('material_b', '30000000-0000-0000-0000-000000000002'),
  ('material_c', '30000000-0000-0000-0000-000000000003'),
  ('client_a',   '40000000-0000-0000-0000-000000000001'),
  ('quote_a',    '50000000-0000-0000-0000-000000000001');

grant select on _test_ids to authenticated;

-- Seed workshops
insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Ledger Test Workshop A'),
  ((select id from _test_ids where key = 'workshop_b'), 'Ledger Test Workshop B');

-- Seed auth users
insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'user_a'), 'ledger-test-a@example.com'),
  ((select id from _test_ids where key = 'user_b'), 'ledger-test-b@example.com');

-- Assign profiles
update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'user_a');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_b')
where id = (select id from _test_ids where key = 'user_b');

-- Seed materials (2 in workshop_a, 1 in workshop_b)
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values
  (
    (select id from _test_ids where key = 'material_a'),
    (select id from _test_ids where key = 'workshop_a'),
    'Ledger Material Alpha',
    'madera',
    'un',
    10,
    100,
    0
  ),
  (
    (select id from _test_ids where key = 'material_b'),
    (select id from _test_ids where key = 'workshop_a'),
    'Ledger Material Beta',
    'madera',
    'un',
    20,
    50,
    0
  ),
  (
    (select id from _test_ids where key = 'material_c'),
    (select id from _test_ids where key = 'workshop_b'),
    'Ledger Material Gamma',
    'madera',
    'm',
    25,
    30,
    0
  );

-- Seed client and quote for quote reference test
insert into public.clients (id, workshop_id, name) values
  ((select id from _test_ids where key = 'client_a'),
   (select id from _test_ids where key = 'workshop_a'),
   'Ledger Test Client');

insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name) values
  ((select id from _test_ids where key = 'quote_a'),
   (select id from _test_ids where key = 'workshop_a'),
   'L-0001',
   (select id from _test_ids where key = 'client_a'),
   'Ledger Test Furniture');

-- Seed stock movements across workshops
-- Workshop A movements (as user_a, then directly for historical null-creator row)
insert into public.stock_movements (id, workshop_id, material_id, delta, reason, note, quote_id, created_by, created_at)
values
  (
    '80000000-0000-0000-0000-000000000001',
    (select id from _test_ids where key = 'workshop_a'),
    (select id from _test_ids where key = 'material_a'),
    50,
    'compra',
    'Initial purchase',
    null,
    (select id from _test_ids where key = 'user_a'),
    '2026-06-01 10:00:00+00'
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    (select id from _test_ids where key = 'workshop_a'),
    (select id from _test_ids where key = 'material_a'),
    -10,
    'consumo',
    'Production use',
    null,
    (select id from _test_ids where key = 'user_a'),
    '2026-06-02 10:00:00+00'
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    (select id from _test_ids where key = 'workshop_a'),
    (select id from _test_ids where key = 'material_b'),
    20,
    'compra',
    'Material B purchase',
    null,
    (select id from _test_ids where key = 'user_a'),
    '2026-06-03 10:00:00+00'
  ),
  (
    '80000000-0000-0000-0000-000000000004',
    (select id from _test_ids where key = 'workshop_a'),
    (select id from _test_ids where key = 'material_a'),
    -5,
    'ajuste',
    'Inventory adjustment',
    null,
    null,  -- historical row with null creator
    '2026-06-04 10:00:00+00'
  ),
  (
    '80000000-0000-0000-0000-000000000005',
    (select id from _test_ids where key = 'workshop_a'),
    (select id from _test_ids where key = 'material_a'),
    -8,
    'descuento_presupuesto',
    'Quote discount',
    (select id from _test_ids where key = 'quote_a'),
    (select id from _test_ids where key = 'user_a'),
    '2026-06-05 10:00:00+00'
  ),
  -- Workshop B movement
  (
    '80000000-0000-0000-0000-000000000006',
    (select id from _test_ids where key = 'workshop_b'),
    (select id from _test_ids where key = 'material_c'),
    15,
    'compra',
    'Workshop B purchase',
    null,
    (select id from _test_ids where key = 'user_b'),
    '2026-06-01 12:00:00+00'
  );

-- Authenticate as user_a (workshop_a)
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'user_a'), true);

-- Test 1: get_stock_movement_ledger() returns only workshop_a rows
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger()$$,
  array[5::bigint],
  'get_stock_movement_ledger() returns only workshop_a rows (5 rows)'
);

-- Test 2: Filter by p_reason
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_reason => 'compra'::stock_movement_reason)$$,
  array[2::bigint],
  'filter by p_reason=compra returns 2 purchase rows'
);

-- Test 3: Filter by p_material_id
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_material_id => (select id from _test_ids where key = 'material_b'))$$,
  array[1::bigint],
  'filter by p_material_id returns only material_b rows'
);

-- Test 4: Filter by p_creator_id (user_a)
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_creator_id => (select id from _test_ids where key = 'user_a'))$$,
  array[4::bigint],
  'filter by p_creator_id=user_a returns 4 rows (leaves out historical null creator)'
);

-- Test 5: Filter by p_from / p_to date range
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(
    p_from => '2026-06-04 00:00:00+00',
    p_to   => '2026-06-06 00:00:00+00'
  )$$,
  array[2::bigint],
  'filter by date range returns rows within 2026-06-04 to 2026-06-06'
);

-- Test 6: Filter by p_search matches material name via ILIKE
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_search => 'beta')$$,
  array[1::bigint],
  'filter by p_search=beta matches material name ILIKE (Ledger Material Beta)'
);

-- Test 7: p_limit above 500 is clamped to 500; p_limit < 1 clamps to 1
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_limit => 1000)$$,
  array[5::bigint],  -- all 5 rows fit under 500
  'p_limit=1000 is clamped to 500, still returns all 5 workshop_a rows'
);

-- Test 8: p_offset < 0 is clamped to 0
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_limit => 2, p_offset => -1)$$,
  array[2::bigint],
  'p_offset=-1 is clamped to 0, returns first 2 rows'
);

-- Test 9: Historical row with created_by IS NULL is still returned
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger() where creator_name is null$$,
  array[1::bigint],
  'historical row with created_by IS NULL is still returned with creator_name=null'
);

-- Test 10: creator_name is populated for non-null created_by
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger() where creator_name is not null$$,
  array[4::bigint],
  '4 rows have creator_name populated (non-null created_by)'
);

-- Test 11: creator_name is not null for rows with created_by
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger() where created_by is not null and creator_name is not null$$,
  array[4::bigint],
  'all rows with non-null created_by have a creator_name'
);

-- R3-M6 boundary tests: 2-char search is silently ignored (length < 3 gate);
-- 3-char search is the boundary that engages the ILIKE filter.
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_search => 'be')$$,
  array[5::bigint],
  'T12: p_search with 2 chars is silently ignored (length<3 gate)'
);

select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_search => 'bet')$$,
  array[1::bigint],
  'T13: p_search with 3 chars (boundary) matches Ledger Material Beta'
);

-- Pagination clamp boundaries: p_limit=0 and p_limit=-5 both clamp to 1;
-- deep p_offset returns an empty set.
select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_limit => 0)$$,
  array[1::bigint],
  'T14: p_limit=0 is clamped to 1, returns first row'
);

select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_limit => -5)$$,
  array[1::bigint],
  'T15: p_limit=-5 is clamped to 1, returns first row'
);

select results_eq(
  $$select count(*)::bigint from get_stock_movement_ledger(p_offset => 99999)$$,
  array[0::bigint],
  'T16: deep p_offset returns empty set'
);

select * from finish();
rollback;
