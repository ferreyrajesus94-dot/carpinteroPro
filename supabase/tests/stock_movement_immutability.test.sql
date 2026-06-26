-- Test: stock_movements append-only contract — defense in depth
--
-- The append-only contract on stock_movements is enforced by two layers:
--   1. RLS policies stock_movements_update and stock_movements_delete
--      (from 0007_stock_movements.sql) scope UPDATE/DELETE to the caller's
--      workshop. The reverse_stock_movement RPC needs FOR UPDATE on the
--      original row to serialize concurrent reversals, so the policies are
--      KEPT (not dropped).
--   2. The prevent_authenticated_stock_movement_mutation trigger raises
--      42501 for any UPDATE/DELETE attempted by an authenticated user.
--      This is the second line of defense: if a future migration weakens
--      or re-introduces a permissive UPDATE/DELETE policy by mistake, the
--      trigger still blocks the mutation.
--
-- service_role maintenance scripts can still mutate by switching to a
-- non-authenticated role (auth.uid() is NULL).

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- T1: the BEFORE UPDATE/DELETE triggers are installed and active
select has_trigger(
  'public', 'stock_movements',
  'prevent_authenticated_stock_movement_update',
  'T1.1: BEFORE UPDATE trigger prevent_authenticated_stock_movement_update is installed'
);

select has_trigger(
  'public', 'stock_movements',
  'prevent_authenticated_stock_movement_delete',
  'T1.2: BEFORE DELETE trigger prevent_authenticated_stock_movement_delete is installed'
);

-- T2: the RLS policies that allow FOR UPDATE inside the same workshop are
-- still in place (the reverse_stock_movement RPC depends on them).
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_movements'
      and policyname = 'stock_movements_update'
  ),
  'T1.3: stock_movements_update policy exists (required for reverse_stock_movement FOR UPDATE)'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_movements'
      and policyname = 'stock_movements_delete'
  ),
  'T1.4: stock_movements_delete policy exists'
);

-- T3: behavior-first assertion of the trigger. RLS deny-by-default would
-- already prevent authenticated UPDATE/DELETE silently, so we add a
-- permissive policy that opens the door, then the trigger is the only
-- gate left. The policy is dropped at the end of the transaction.
--
-- R3-B1: this is the behavior test that locks the append-only contract to
-- actual behavior, not just to the catalog. A future migration that drops
-- or weakens the trigger leaves this test failing.
create temporary table _test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-000000000001'),
  ('user_a',     '20000000-0000-0000-0000-000000000001'),
  ('material_a', '30000000-0000-0000-0000-000000000001'),
  ('movement_a', '40000000-0000-0000-0000-000000000001');

grant select on _test_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'user_a'), 'immutability@example.com');

insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Immutability Behavior Workshop');

update public.profiles set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'user_a');
update public.profiles set workshop_role = 'admin'::public.workshop_user_role
where id = (select id from _test_ids where key = 'user_a');

insert into public.materials (id, workshop_id, name, unit, stock)
values
  ((select id from _test_ids where key = 'material_a'),
   (select id from _test_ids where key = 'workshop_a'),
   'Madera immutabilidad', 'un', 10);

insert into public.stock_movements (
  id, workshop_id, material_id, delta, reason
)
select
  (select id from _test_ids where key = 'movement_a'),
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'material_a'),
  5, 'compra'::public.stock_movement_reason;

-- Open a permissive UPDATE/DELETE policy. The trigger is the only gate
-- that protects the row. RLS is exercised to prove the trigger fires
-- before RLS check.
create policy stock_movement_immutability_test_update on public.stock_movements
  for update using (true) with check (true);
create policy stock_movement_immutability_test_delete on public.stock_movements
  for delete using (true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _test_ids where key = 'user_a'),
  true);

-- T3.1: authenticated UPDATE is rejected with 42501 (the trigger fires)
select throws_ok(
  $$update public.stock_movements
      set note = 'tampered'
    where id = (select id from _test_ids where key = 'movement_a')$$,
  '42501',
  'stock_movements are immutable; use reverse_stock_movement instead',
  'T3.1: authenticated UPDATE is rejected with 42501 (trigger fires even with permissive policy)'
);

-- T3.2: the row is unchanged after the rejected UPDATE
select is(
  (select note from public.stock_movements
    where id = (select id from _test_ids where key = 'movement_a')),
  null::text,
  'T3.2: row note is unchanged after rejected authenticated UPDATE'
);

-- T3.3: authenticated DELETE is rejected with 42501
select throws_ok(
  $$delete from public.stock_movements
    where id = (select id from _test_ids where key = 'movement_a')$$,
  '42501',
  'stock_movements are immutable; use reverse_stock_movement instead',
  'T3.3: authenticated DELETE is rejected with 42501 (trigger fires even with permissive policy)'
);

-- T3.4: the row is not deleted
select is(
  (select count(*) from public.stock_movements
    where id = (select id from _test_ids where key = 'movement_a')),
  1::bigint,
  'T3.4: row is not deleted after rejected authenticated DELETE'
);

select * from finish();
rollback;
