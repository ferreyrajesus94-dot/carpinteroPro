-- Test: stock_movements append-only contract — defense in depth
--
-- The append-only contract on stock_movements is enforced by TWO layers:
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

select plan(4);

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

select * from finish();
rollback;
