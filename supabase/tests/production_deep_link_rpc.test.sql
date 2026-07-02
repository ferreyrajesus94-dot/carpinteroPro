-- Test: get_stock_movement_detail surfaces production_order_id (PR 7)
--
-- Verifies the PR-7 deliverable for the production-order-state-machine
-- change: the inventory deep-link surface contract.
--
--   1. get_stock_movement_detail returns production_order_id (new column).
--   2. The new column is the production_order_id of the linked deduction
--      batch, when the movement's deduction has a non-null FK.
--   3. The new column is NULL for:
--      - non-production movements (no production_deduction_id), and
--      - legacy deduction batches (production_order_id = NULL), and
--      - the deduction's production order has been deleted
--        (ON DELETE SET NULL semantics).
--   4. Cross-workshop leakage: a workshop_b user calling
--      get_stock_movement_detail for a workshop_a movement does not see
--      the workshop_a production_order_id (RLS still scopes by
--      workshop_id on the underlying stock_movements row).
--
-- All assertions are deterministic. The test seeds its own data in
-- temporary tables and reseeds rows so it does not depend on prior
-- migration state.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _dl_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _dl_ids (key, id) values
  -- Workshops
  ('workshop_a', 'dd000000-0000-0000-0000-0000000000a1'),
  ('workshop_b', 'dd000000-0000-0000-0000-0000000000b1'),
  -- Users (admins in each workshop — must satisfy profiles.role check)
  ('admin_a',    'dd000000-0000-0000-0000-0000000000a2'),
  ('admin_b',    'dd000000-0000-0000-0000-0000000000b2'),
  -- Materials
  ('material_a', 'dd000000-0000-0000-0000-0000000000a3'),
  ('material_b', 'dd000000-0000-0000-0000-0000000000b3'),
  -- Quotes (referenced by movements, no production orders)
  ('quote_a',    'dd000000-0000-0000-0000-0000000000a4'),
  ('quote_b',    'dd000000-0000-0000-0000-0000000000b4'),
  -- A production order in workshop_a (linked to the new-flow batch)
  ('order_a',    'dd000000-0000-0000-0000-0000000000a5'),
  -- A pre-seeded deduction batch id for the new-flow test
  ('ded_new',    'dd000000-0000-0000-0000-0000000000a6'),
  -- A pre-seeded deduction batch id for the legacy (null link) test
  ('ded_legacy', 'dd000000-0000-0000-0000-0000000000a7');

grant select on _dl_ids to authenticated, service_role;

-- Seed workshops
insert into public.workshops (id, name) values
  ((select id from _dl_ids where key = 'workshop_a'), 'DeepLink Workshop A'),
  ((select id from _dl_ids where key = 'workshop_b'), 'DeepLink Workshop B');

-- Seed auth users
insert into auth.users (id, email) values
  ((select id from _dl_ids where key = 'admin_a'), 'dl-admin-a@example.com'),
  ((select id from _dl_ids where key = 'admin_b'), 'dl-admin-b@example.com');

-- Assign profiles + roles. The profiles table in this project uses
-- `workshop_id` for tenant scoping and a `workshop_role` column
-- ('admin' | 'operational' | 'viewer') that the
-- get_stock_movement_detail RPC reads to compute `can_reverse`. The
-- production-order RPCs use a separate `role` column, but we are only
-- testing the read RPC here, so workshop_role is sufficient.
update public.profiles
set workshop_id = (select id from _dl_ids where key = 'workshop_a'),
    workshop_role = 'admin'::public.workshop_user_role
where id = (select id from _dl_ids where key = 'admin_a');

update public.profiles
set workshop_id = (select id from _dl_ids where key = 'workshop_b'),
    workshop_role = 'admin'::public.workshop_user_role
where id = (select id from _dl_ids where key = 'admin_b');

-- Seed materials
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values
  (
    (select id from _dl_ids where key = 'material_a'),
    (select id from _dl_ids where key = 'workshop_a'),
    'DeepLink Material Alpha',
    'madera', 'un', 10, 100, 0
  ),
  (
    (select id from _dl_ids where key = 'material_b'),
    (select id from _dl_ids where key = 'workshop_a'),
    'DeepLink Material Beta',
    'madera', 'un', 10, 100, 0
  );

-- Seed a quote that the production order and the deduction batch both
-- reference. production_orders.quote_id is NOT NULL and FKs to
-- quotes(id), so we need a quote row before the order.
set local role service_role;
insert into public.quotes (
  id, workshop_id, quote_number, furniture_name, status
) values
  (
    (select id from _dl_ids where key = 'quote_a'),
    (select id from _dl_ids where key = 'workshop_a'),
    'P-9001',
    'DeepLink Test Furniture A',
    'aprobado'
  ),
  (
    (select id from _dl_ids where key = 'quote_b'),
    (select id from _dl_ids where key = 'workshop_a'),
    'P-9002',
    'DeepLink Test Furniture B',
    'aprobado'
  );
reset role;

-- Seed the production order that the new-flow deduction will link to.
-- We insert as a service role bypass (the RLS INSERT path is restricted
-- to the SECURITY DEFINER RPCs, but pgTAP tests need to seed data
-- outside that path).
set local role service_role;
insert into public.production_orders (
  id, workshop_id, quote_id, production_number, state
) values (
  (select id from _dl_ids where key = 'order_a'),
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'quote_a'),
  'OP-DL-0001',
  'planned'
);
reset role;

-- ==========================================================================
-- T1: get_stock_movement_detail returns production_order_id (new column)
-- ==========================================================================

-- T1.1: the RPC exists
select has_function(
  'public', 'get_stock_movement_detail',
  array['uuid'],
  'T1.1: get_stock_movement_detail(uuid) RPC exists'
);

-- Seed a new-flow deduction batch + a production movement that links
-- to it. Use service_role to bypass the write guard (the inventory
-- detail RPC is read-only; the writes here are test setup).
set local role service_role;
insert into public.quote_production_stock_deductions (
  id, workshop_id, quote_id, production_order_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _dl_ids where key = 'ded_new'),
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'quote_a'),
  (select id from _dl_ids where key = 'order_a'),
  'completed',
  true, false, false,
  '[]'::jsonb,
  (select id from _dl_ids where key = 'admin_a')
);

insert into public.stock_movements (
  id, workshop_id, material_id, delta, reason, note, quote_id, created_by,
  production_deduction_id
) values (
  'dd000000-0000-0000-0000-0000000000c1',
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'material_a'),
  5, 'consumo_produccion', 'New-flow consumption', null,
  (select id from _dl_ids where key = 'admin_a'),
  (select id from _dl_ids where key = 'ded_new')
);
reset role;

-- T1.2: as admin_a, the new column matches the order we seeded
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _dl_ids where key = 'admin_a'), true);

select results_eq(
  $$select production_order_id
      from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c1'::uuid)
     limit 1$$,
  $$select (select id from _dl_ids where key = 'order_a')$$,
  'T1.2: production-origin movement surfaces the deduction''s production_order_id'
);

-- ==========================================================================
-- T2: NULL when the movement is not a production-origin movement
-- ==========================================================================

set local role service_role;
insert into public.stock_movements (
  id, workshop_id, material_id, delta, reason, note, quote_id, created_by
) values (
  'dd000000-0000-0000-0000-0000000000c2',
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'material_b'),
  10, 'compra', 'Compra directa', null,
  (select id from _dl_ids where key = 'admin_a')
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _dl_ids where key = 'admin_a'), true);

select results_eq(
  $$select production_order_id is null
      from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c2'::uuid)
     limit 1$$,
  $$values (true)$$,
  'T2.1: non-production movement (compra) has production_order_id = NULL'
);

-- ==========================================================================
-- T3: NULL when the deduction batch is a legacy (pre-PR-4) batch
-- ==========================================================================

set local role service_role;
-- Create a legacy deduction batch (no production_order_id) and a
-- production movement that references it. Use quote_b (not quote_a) so
-- the active-batch unique constraint does not collide with the new-flow
-- batch we inserted in T1.2.
insert into public.quote_production_stock_deductions (
  id, workshop_id, quote_id, production_order_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _dl_ids where key = 'ded_legacy'),
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'quote_b'),
  null, -- legacy batch
  'completed',
  true, false, false,
  '[]'::jsonb,
  (select id from _dl_ids where key = 'admin_a')
);

insert into public.stock_movements (
  id, workshop_id, material_id, delta, reason, note, quote_id, created_by,
  production_deduction_id
) values (
  'dd000000-0000-0000-0000-0000000000c3',
  (select id from _dl_ids where key = 'workshop_a'),
  (select id from _dl_ids where key = 'material_a'),
  3, 'consumo_produccion', 'Legacy consumption', null,
  (select id from _dl_ids where key = 'admin_a'),
  (select id from _dl_ids where key = 'ded_legacy')
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _dl_ids where key = 'admin_a'), true);

select results_eq(
  $$select production_order_id is null
      from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c3'::uuid)
     limit 1$$,
  $$values (true)$$,
  'T3.1: legacy deduction batch (production_order_id = NULL) surfaces as NULL'
);

-- ==========================================================================
-- T4: NULL when the production order has been deleted (ON DELETE SET NULL)
-- ==========================================================================

-- The defense-in-depth trigger blocks DELETE on production_orders when
-- auth.uid() IS NOT NULL. Clear the JWT and reset the role to bypass
-- the trigger — the same approach as PR 4's
-- production_deduction_link.test.sql T11.2.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
delete from public.production_orders
 where id = (select id from _dl_ids where key = 'order_a');

-- Re-authenticate as admin_a for the post-delete assertion.
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _dl_ids where key = 'admin_a'), true);

-- Re-check the T1.2 movement: after deleting the order, the deduction's
-- production_order_id is null, so the movement's new column must also
-- be null.
select results_eq(
  $$select production_order_id is null
      from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c1'::uuid)
     limit 1$$,
  $$values (true)$$,
  'T4.1: after deleting the production order, the movement''s production_order_id is SET NULL (ON DELETE SET NULL propagates)'
);

-- ==========================================================================
-- T5: RLS still scopes the new column by workshop (defense in depth)
-- ==========================================================================

-- T5.1: as admin_b, the workshop_a movement is not visible at all
--       (RLS scopes the underlying stock_movements row, so the new
--        column can never leak to another workshop).
select set_config('request.jwt.claim.sub',
  (select id::text from _dl_ids where key = 'admin_b'), true);

select is_empty(
  $$select * from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'T5.1: cross-workshop RPC call returns 0 rows (RLS scopes by workshop_id; production_order_id cannot leak)'
);

-- T5.2: as admin_b, a non-existent movement returns 0 rows
select is_empty(
  $$select * from public.get_stock_movement_detail('ee000000-0000-0000-0000-0000000000ff'::uuid)$$,
  'T5.2: cross-workshop RPC call for a non-existent movement returns 0 rows'
);

-- T5.3: as admin_a, the cross-workshop order id (which we deleted) was
--        never visible to admin_b, so the new column for the T1.2
--        movement is NULL for admin_b (RLS hides the row, so the
--        production_order_id is unreachable).
select is_empty(
  $$select * from public.get_stock_movement_detail('dd000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'T5.3: admin_b cannot see workshop_a movements, so the new production_order_id column is unreachable across workshops'
);

rollback;
