-- Regression test: apply_stock_movement sets created_by to auth.uid()
-- and still denies cross-workshop stock movement attempts.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

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
  ('material_b', '30000000-0000-0000-0000-000000000002');

grant select on _test_ids to authenticated;

-- Seed workshops
insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Creator Test Workshop A'),
  ((select id from _test_ids where key = 'workshop_b'), 'Creator Test Workshop B');

-- Seed auth users
insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'user_a'), 'creator-test-a@example.com'),
  ((select id from _test_ids where key = 'user_b'), 'creator-test-b@example.com');

-- Assign profiles to workshops (workshop_a for user_a, workshop_b for user_b)
update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'user_a');

update public.profiles
set workshop_id = (select id from _test_ids where key = 'workshop_b')
where id = (select id from _test_ids where key = 'user_b');

-- Seed materials
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values
  (
    (select id from _test_ids where key = 'material_a'),
    (select id from _test_ids where key = 'workshop_a'),
    'Creator Test Material A',
    'madera',
    'un',
    10,
    100,
    0
  ),
  (
    (select id from _test_ids where key = 'material_b'),
    (select id from _test_ids where key = 'workshop_b'),
    'Creator Test Material B',
    'madera',
    'un',
    15,
    50,
    0
  );

-- T1.1: Assert apply_stock_movement sets created_by = auth.uid()
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'user_a'), true);

select lives_ok(
  $$select apply_stock_movement(
    (select id from _test_ids where key = 'material_a'),
    10,
    'compra'::stock_movement_reason,
    'test purchase',
    null
  )$$,
  'user_a can apply stock movement on workshop_a material'
);

-- RED expectation: this will FAIL against current migration (created_by is null)
select is(
  (select created_by from stock_movements
   where material_id = (select id from _test_ids where key = 'material_a')
   order by created_at desc limit 1),
  (select id from _test_ids where key = 'user_a'),
  'created_by should equal the authenticated user (RED — expected to fail until migration)'
);

-- T1.5: Cross-workshop denial (also tested here for TRIANGULATE)
select set_config('request.jwt.claim.sub', (select id::text from _test_ids where key = 'user_a'), true);

-- NOTE: The cross-workshop material is invisible through RLS (material_b is in workshop_b,
-- user_a can only see workshop_a), so the SELECT inside the function returns NULL
-- and raises a generic P0001 exception rather than 42501.
select throws_ok(
  $$select apply_stock_movement(
    (select id from _test_ids where key = 'material_b'),
    5,
    'compra'::stock_movement_reason,
    'cross-workshop attempt',
    null
  )$$,
  null,
  null,
  'user_a cannot apply stock movement on workshop_b material (cross-workshop denial)'
);

-- Assert no movement row was inserted for that cross-workshop attempt
select results_eq(
  $$select count(*)::bigint from stock_movements where material_id = (select id from _test_ids where key = 'material_b')$$,
  array[0::bigint],
  'no stock movement row was inserted for the cross-workshop attempt'
);

-- T1.5 also: user_a can still see only their own movement
select results_eq(
  $$select count(*)::bigint from stock_movements where material_id = (select id from _test_ids where key = 'material_a')$$,
  array[1::bigint],
  'user_a can see their own movement row'
);

select * from finish();
rollback;
