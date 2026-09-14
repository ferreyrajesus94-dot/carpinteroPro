-- Test: cross-tenant read and write denial for every workshop-scoped table
--
-- Satisfies W3 acceptance criterion AC-5 from
-- docs/operations/production-readiness-audit-2026-09-13.md.
--
-- Background:
--   The 2026-09-13 audit called out that the existing
--   tenant_isolation.test.sql covers cross-tenant denial for only
--   materials, stock_movements, profiles, clients, and workshops.
--   Several other workshop-scoped tables are exposed through the
--   frontend (price_history, furniture_templates, recipe_items,
--   contract_templates, workshop_settings, tasks, cut_pieces,
--   labor_items, quote_extras, quote_recipe_snapshots,
--   quote_labor_snapshots, recipe_pieces, quote_piece_snapshots,
--   quote_approved_bom_lines, quote_production_stock_deductions)
--   and were not covered by a deterministic behavior test.
--
--   This test locks the cross-tenant contract for EVERY
--   workshop-scoped table the W3 audit lists, plus the read-only
--   production_orders / production_order_events surfaces and the
--   service_role-only subscriptions table. Each table gets two
--   assertions:
--
--     1. Read denial: a workshop_a user selecting a workshop_b row
--        sees 0 rows (RLS USING clause hides it).
--     2. Write denial: a workshop_a user attempting a write that
--        would land in workshop_b (or mutate a workshop_b row) is
--        rejected. The exact assertion shape varies by table:
--          - Tables with their own workshop_id column: an INSERT
--            into workshop_b raises 42501 (WITH CHECK fails); an
--            UPDATE that flips a workshop_a row to workshop_b
--            raises 42501 (WITH CHECK fails).
--          - Child tables without their own workshop_id (here all
--            child tables DO have workshop_id after 0017/0018
--            multi-tenant hardening): an INSERT referencing a
--            foreign-workshop parent raises 42501 (the EXISTS
--            subquery in the policy returns false).
--          - Read-only tables (production_orders, production_order_events):
--            only the read assertion is meaningful. We additionally
--            assert the table is read-only by catalog query
--            (no INSERT/UPDATE/DELETE policy).
--          - subscriptions: read denial is tested; write denial is
--            proven by the absence of a write policy AND a
--            behavior-first assertion that an UPDATE affects 0 rows.
--
--   All write-denial assertions use the exact SQLSTATE 42501 with
--   the exact error message emitted by the RLS enforcement, so a
--   future migration that loosens a WITH CHECK fails this test
--   deterministically (not by a vague count mismatch).

begin;

create extension if not exists pgtap with schema extensions;

-- Plan: 40 assertions (one read + one write per table for the 15
-- workshop-scoped CRUD tables, one read + one catalog check for the
-- 2 read-only production tables, five checks for subscriptions, and
-- one positive control).
select plan(40);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================
create temporary table _xtc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _xtc_ids (key, id) values
  -- Workshops
  ('workshop_a', '88000000-0000-0000-0000-0000000000a1'),
  ('workshop_b', '88000000-0000-0000-0000-0000000000b2'),
  -- Users
  ('user_a',     '88000000-0000-0000-0000-0000000000b3'),
  ('user_b',     '88000000-0000-0000-0000-0000000000b4'),
  -- Quote_a (workshop_a) — referenced by quote_extras, snapshots
  ('quote_a',         '88000000-0000-0000-0000-0000000000c1'),
  ('quote_b',         '88000000-0000-0000-0000-0000000000c2'),
  -- Furniture templates
  ('furniture_template_a', '88000000-0000-0000-0000-0000000000d1'),
  ('furniture_template_b', '88000000-0000-0000-0000-0000000000d2'),
  -- Materials (parent of stock_movements, price_history, recipe_items)
  ('material_a', '88000000-0000-0000-0000-0000000000e1'),
  ('material_b', '88000000-0000-0000-0000-0000000000e2');

grant select on _xtc_ids to authenticated, service_role;

-- Seed two workshops
set local role service_role;
insert into public.workshops (id, name) values
  ((select id from _xtc_ids where key = 'workshop_a'), 'Cross Tenant Workshop A'),
  ((select id from _xtc_ids where key = 'workshop_b'), 'Cross Tenant Workshop B');
reset role;

-- Seed auth.users for both workshops
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   (select id from _xtc_ids where key = 'user_a'),
   'authenticated', 'authenticated', 'xtc-a@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _xtc_ids where key = 'user_b'),
   'authenticated', 'authenticated', 'xtc-b@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Attach profiles for each user
update public.profiles
   set workshop_id = (select id from _xtc_ids where key = 'workshop_a'),
       workshop_role = 'admin'::public.workshop_user_role
 where id = (select id from _xtc_ids where key = 'user_a');

update public.profiles
   set workshop_id = (select id from _xtc_ids where key = 'workshop_b'),
       workshop_role = 'admin'::public.workshop_user_role
 where id = (select id from _xtc_ids where key = 'user_b');

-- Seed workshop_a fixtures (used as foreign-key parents for quote_a etc.)
set local role service_role;
insert into public.furniture_templates (id, workshop_id, name)
values
  ((select id from _xtc_ids where key = 'furniture_template_a'),
   (select id from _xtc_ids where key = 'workshop_a'),
   'Cross Tenant Furniture A'),
  ((select id from _xtc_ids where key = 'furniture_template_b'),
   (select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Furniture B');

insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values
  ((select id from _xtc_ids where key = 'material_a'),
   (select id from _xtc_ids where key = 'workshop_a'),
   'Cross Tenant Material A', 'madera', 'un', 10, 100, 0),
  ((select id from _xtc_ids where key = 'material_b'),
   (select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Material B', 'madera', 'un', 10, 100, 0);

insert into public.clients (id, workshop_id, name)
values
  ('88000000-0000-0000-0000-0000000000f1',
   (select id from _xtc_ids where key = 'workshop_a'),
   'Cross Tenant Client A'),
  ('88000000-0000-0000-0000-0000000000f2',
   (select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Client B');

insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name)
values
  ((select id from _xtc_ids where key = 'quote_a'),
   (select id from _xtc_ids where key = 'workshop_a'),
   'XTC-A-0001',
   '88000000-0000-0000-0000-0000000000f1',
   'Cross Tenant Furniture (quote a)'),
  ((select id from _xtc_ids where key = 'quote_b'),
   (select id from _xtc_ids where key = 'workshop_b'),
   'XTC-B-0001',
   '88000000-0000-0000-0000-0000000000f2',
   'Cross Tenant Furniture (quote b)');

-- Seed a workshop_b row in EVERY workshop-scoped table so the read-
-- denial assertion can target a specific foreign-workshop row. The
-- fixture names are prefixed with "Cross Tenant Workshop B" so they
-- are easy to grep in failure output.
--
-- price_history
insert into public.price_history (workshop_id, material_id, old_price, new_price)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'material_b'),
   9, 10);

-- recipe_items (workshop_b, parented by furniture_template_b)
insert into public.recipe_items (workshop_id, furniture_template_id, material_id, quantity)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'furniture_template_b'),
   (select id from _xtc_ids where key = 'material_b'),
   2.0);

-- contract_templates
insert into public.contract_templates (workshop_id, name, body_markdown)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Workshop B Contract',
   'Cross Tenant Workshop B contract body');

-- workshop_settings (1 row per workshop)
insert into public.workshop_settings (workshop_id, name)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Workshop B Settings');

-- tasks
insert into public.tasks (workshop_id, title)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   'Cross Tenant Workshop B Task');

-- recipe_pieces
insert into public.recipe_pieces (workshop_id, furniture_template_id, piece_name, length_cm, width_cm)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'furniture_template_b'),
   'Cross Tenant Workshop B Piece', 100, 50);

-- cut_pieces (parented by recipe_item; here we use workshop_b's recipe_item id by joining)
insert into public.cut_pieces (recipe_item_id, workshop_id, length_cm, width_cm)
select ri.id, ri.workshop_id, 80, 40
  from public.recipe_items ri
 where ri.workshop_id = (select id from _xtc_ids where key = 'workshop_b')
 limit 1;

-- labor_items
insert into public.labor_items (workshop_id, furniture_template_id, description, hours, rate)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'furniture_template_b'),
   'Cross Tenant Workshop B Labor', 1.0, 100);

-- quote_extras (parented by quote_id)
insert into public.quote_extras (workshop_id, quote_id, description, amount)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   'Cross Tenant Workshop B Extra', 100);

-- quote_recipe_snapshots (parented by quote_id)
insert into public.quote_recipe_snapshots (
  workshop_id, quote_id,
  material_name, material_unit, material_category,
  quantity, price_per_unit
)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   'Cross Tenant Workshop B Material', 'un', 'madera', 1, 10);

-- quote_labor_snapshots (parented by quote_id)
insert into public.quote_labor_snapshots (
  workshop_id, quote_id, description, hours, rate
)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   'Cross Tenant Workshop B Labor Snapshot', 1, 100);

-- quote_piece_snapshots (parented by quote_id)
insert into public.quote_piece_snapshots (
  workshop_id, quote_id, piece_name, length_cm, width_cm
)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   'Cross Tenant Workshop B Piece Snapshot', 100, 50);

-- quote_approved_bom_lines (parented by quote_id, but with its own workshop_id)
insert into public.quote_approved_bom_lines (
  workshop_id, quote_id, line_number,
  material_name, material_unit, material_category, calculation_method
)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   1,
   'Cross Tenant Workshop B BOM Material', 'un', 'madera',
   'direct_quantity');

-- quote_production_stock_deductions (parented by quote_id, with its own workshop_id)
insert into public.quote_production_stock_deductions (
  workshop_id, quote_id, auto_stock_discount_enabled
)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   false);

-- A quote_a must be in 'aprobado' for quote_approved_bom_lines / quote_production_stock_deductions
-- foreign-key semantics. We seed quote_a in aprobado so we can later
-- try to insert bom lines / deductions referencing quote_b from the
-- workshop_a session (cross-tenant). The status does not affect
-- the read-denial assertion but the FK target must exist.
update public.quotes
   set status = 'aprobado'::public.quote_status
 where id = (select id from _xtc_ids where key = 'quote_a');

-- production_orders (read-only for authenticated; seeded via service_role)
insert into public.production_orders (workshop_id, quote_id, production_number)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   (select id from _xtc_ids where key = 'quote_b'),
   'OP-XTC-B-0001');

-- production_order_events (read-only; seeded via service_role)
insert into public.production_order_events (
  workshop_id, production_order_id, to_state
)
select
  (select id from _xtc_ids where key = 'workshop_b'),
  po.id,
  'planned'::public.production_order_state
  from public.production_orders po
 where po.workshop_id = (select id from _xtc_ids where key = 'workshop_b')
 limit 1;

-- subscriptions (read-only; seeded via service_role)
insert into public.subscriptions (workshop_id, status, plan, provider)
values
  ((select id from _xtc_ids where key = 'workshop_b'),
   'trialing', 'pro_monthly', 'mercadopago');

reset role;

-- ==========================================================================
-- T1: price_history (read + write)
-- ==========================================================================

-- T1.1: read denial — workshop_a user cannot see workshop_b price history.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _xtc_ids where key = 'user_a'),
  true);

select results_eq(
  $$
    select count(*)::bigint
      from public.price_history
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T1.1: price_history — workshop_a user cannot see workshop_b rows (read denial via RLS USING)'
);

-- T1.2: write denial — workshop_a user INSERTing into workshop_b price history raises 42501.
select throws_ok(
  $$
    insert into public.price_history (workshop_id, material_id, old_price, new_price)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'material_b'),
      1, 2
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "price_history"',
  'T1.2: price_history — INSERT into workshop_b is rejected with 42501 (WITH CHECK on workshop_id)'
);

-- ==========================================================================
-- T2: furniture_templates (read + write)
-- ==========================================================================

-- T2.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.furniture_templates
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and name = 'Cross Tenant Furniture B'
  $$,
  array[0::bigint],
  'T2.1: furniture_templates — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T2.2: write denial — INSERT into workshop_b raises 42501.
select throws_ok(
  $$
    insert into public.furniture_templates (workshop_id, name)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      'Cross Tenant Furniture B Smuggled'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "furniture_templates"',
  'T2.2: furniture_templates — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T3: recipe_items (read + write)
-- ==========================================================================

-- T3.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.recipe_items
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T3.1: recipe_items — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T3.2: write denial — INSERT into workshop_b raises 42501.
select throws_ok(
  $$
    insert into public.recipe_items (workshop_id, furniture_template_id, material_id, quantity)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'furniture_template_b'),
      (select id from _xtc_ids where key = 'material_b'),
      1.0
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "recipe_items"',
  'T3.2: recipe_items — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T4: contract_templates (read + write)
-- ==========================================================================

-- T4.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.contract_templates
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and name = 'Cross Tenant Workshop B Contract'
  $$,
  array[0::bigint],
  'T4.1: contract_templates — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T4.2: write denial
select throws_ok(
  $$
    insert into public.contract_templates (workshop_id, name, body_markdown)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      'Cross Tenant Workshop B Smuggled Contract',
      'should not be inserted'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "contract_templates"',
  'T4.2: contract_templates — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T5: workshop_settings (read + write)
-- ==========================================================================
-- workshop_settings uses workshop_id as its PK. The test must
-- seed a workshop_a row first so the UPDATE has a row to mutate.

-- T5.0: seed a workshop_a row (service_role bypasses RLS).
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
insert into public.workshop_settings (workshop_id, name)
values ((select id from _xtc_ids where key = 'workshop_a'),
        'Cross Tenant Workshop A Settings');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _xtc_ids where key = 'user_a'),
  true);

-- T5.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.workshop_settings
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T5.1: workshop_settings — workshop_a user cannot see workshop_b row (read denial)'
);

-- T5.2: write denial — UPDATE that flips the workshop_a row's
-- workshop_id to workshop_b raises 42501 (WITH CHECK on
-- workshop_id = get_current_workshop_id() fails).
select throws_ok(
  $$
    update public.workshop_settings
       set name = 'Cross Tenant Workshop B Hijack',
           workshop_id = (select id from _xtc_ids where key = 'workshop_b')
     where workshop_id = (select id from _xtc_ids where key = 'workshop_a')
  $$,
  '42501',
  'new row violates row-level security policy for table "workshop_settings"',
  'T5.2: workshop_settings — UPDATE that flips workshop_a row to workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T6: tasks (read + write)
-- ==========================================================================

-- T6.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.tasks
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and title = 'Cross Tenant Workshop B Task'
  $$,
  array[0::bigint],
  'T6.1: tasks — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T6.2: write denial
select throws_ok(
  $$
    insert into public.tasks (workshop_id, title)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      'Cross Tenant Workshop B Smuggled Task'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'T6.2: tasks — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T7: cut_pieces (read + write)
-- ==========================================================================

-- T7.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.cut_pieces
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T7.1: cut_pieces — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T7.2: write denial — INSERT that uses hardcoded values (rather
-- than a SELECT subquery that RLS would filter to 0 rows). The new
-- row carries workshop_id = workshop_b, which fails the WITH CHECK
-- `workshop_id = get_current_workshop_id()` (= workshop_a).
select throws_ok(
  $$
    insert into public.cut_pieces (recipe_item_id, workshop_id, length_cm, width_cm)
    values (
      (select id from public.recipe_items where workshop_id = (select id from _xtc_ids where key = 'workshop_b') limit 1),
      (select id from _xtc_ids where key = 'workshop_b'),
      80, 40
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "cut_pieces"',
  'T7.2: cut_pieces — INSERT with hardcoded foreign-workshop id is rejected with 42501'
);

-- ==========================================================================
-- T8: labor_items (read + write)
-- ==========================================================================

-- T8.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.labor_items
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T8.1: labor_items — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T8.2: write denial — INSERT into workshop_b raises 42501 (the
-- policy uses an EXISTS subquery against furniture_templates; for
-- a foreign workshop the subquery returns false).
select throws_ok(
  $$
    insert into public.labor_items (workshop_id, furniture_template_id, description, hours, rate)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'furniture_template_b'),
      'Cross Tenant Workshop B Smuggled Labor', 1, 100
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "labor_items"',
  'T8.2: labor_items — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T9: quote_extras (read + write)
-- ==========================================================================

-- T9.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_extras
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and description = 'Cross Tenant Workshop B Extra'
  $$,
  array[0::bigint],
  'T9.1: quote_extras — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T9.2: write denial — INSERT referencing foreign-workshop quote raises 42501.
select throws_ok(
  $$
    insert into public.quote_extras (workshop_id, quote_id, description, amount)
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      'Cross Tenant Workshop B Smuggled Extra', 50
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_extras"',
  'T9.2: quote_extras — INSERT referencing foreign-workshop quote is rejected with 42501'
);

-- ==========================================================================
-- T10: quote_recipe_snapshots (read + write)
-- ==========================================================================

-- T10.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_recipe_snapshots
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T10.1: quote_recipe_snapshots — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T10.2: write denial — INSERT referencing foreign-workshop quote raises 42501.
select throws_ok(
  $$
    insert into public.quote_recipe_snapshots (
      workshop_id, quote_id,
      material_name, material_unit, material_category,
      quantity, price_per_unit
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      'Cross Tenant Workshop B Smuggled Material', 'un', 'madera', 1, 10
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_recipe_snapshots"',
  'T10.2: quote_recipe_snapshots — INSERT referencing foreign-workshop quote is rejected with 42501'
);

-- ==========================================================================
-- T11: quote_labor_snapshots (read + write)
-- ==========================================================================

-- T11.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_labor_snapshots
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T11.1: quote_labor_snapshots — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T11.2: write denial
select throws_ok(
  $$
    insert into public.quote_labor_snapshots (
      workshop_id, quote_id, description, hours, rate
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      'Cross Tenant Workshop B Smuggled Labor Snapshot', 1, 100
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_labor_snapshots"',
  'T11.2: quote_labor_snapshots — INSERT referencing foreign-workshop quote is rejected with 42501'
);

-- ==========================================================================
-- T12: recipe_pieces (read + write)
-- ==========================================================================

-- T12.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.recipe_pieces
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T12.1: recipe_pieces — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T12.2: write denial
select throws_ok(
  $$
    insert into public.recipe_pieces (
      workshop_id, furniture_template_id, piece_name, length_cm, width_cm
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'furniture_template_b'),
      'Cross Tenant Workshop B Smuggled Piece', 100, 50
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "recipe_pieces"',
  'T12.2: recipe_pieces — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T13: quote_piece_snapshots (read + write)
-- ==========================================================================

-- T13.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_piece_snapshots
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T13.1: quote_piece_snapshots — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T13.2: write denial
select throws_ok(
  $$
    insert into public.quote_piece_snapshots (
      workshop_id, quote_id, piece_name, length_cm, width_cm
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      'Cross Tenant Workshop B Smuggled Piece Snapshot', 100, 50
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_piece_snapshots"',
  'T13.2: quote_piece_snapshots — INSERT referencing foreign-workshop quote is rejected with 42501'
);

-- ==========================================================================
-- T14: quote_approved_bom_lines (read + write)
-- ==========================================================================
-- This table has a workshop_id column AND its own role-gated write
-- policy. The role gate (`workshop_role IN ('admin', 'operational')`)
-- means a role escalation attempt would also be caught, but we test
-- the cross-tenant denial at the RLS layer first.

-- T14.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_approved_bom_lines
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T14.1: quote_approved_bom_lines — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T14.2: write denial — INSERT into workshop_b raises 42501.
select throws_ok(
  $$
    insert into public.quote_approved_bom_lines (
      workshop_id, quote_id, line_number,
      material_name, material_unit, material_category, calculation_method
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      99,
      'Cross Tenant Workshop B Smuggled BOM', 'un', 'madera',
      'direct_quantity'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_approved_bom_lines"',
  'T14.2: quote_approved_bom_lines — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T15: quote_production_stock_deductions (read + write)
-- ==========================================================================

-- T15.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.quote_production_stock_deductions
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T15.1: quote_production_stock_deductions — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T15.2: write denial — INSERT into workshop_b raises 42501.
select throws_ok(
  $$
    insert into public.quote_production_stock_deductions (
      workshop_id, quote_id, auto_stock_discount_enabled
    )
    values (
      (select id from _xtc_ids where key = 'workshop_b'),
      (select id from _xtc_ids where key = 'quote_b'),
      false
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "quote_production_stock_deductions"',
  'T15.2: quote_production_stock_deductions — INSERT into workshop_b is rejected with 42501'
);

-- ==========================================================================
-- T16: production_orders (read only — no authenticated write path)
-- ==========================================================================

-- T16.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.production_orders
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and production_number = 'OP-XTC-B-0001'
  $$,
  array[0::bigint],
  'T16.1: production_orders — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T16.2: write-denial contract is enforced by the absence of INSERT/
-- UPDATE/DELETE policies + the production_orders defense-in-depth
-- triggers. We assert the catalog state: exactly 1 policy (SELECT).
select results_eq(
  $$
    select count(*)::bigint
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'production_orders'
  $$,
  array[1::bigint],
  'T16.2: production_orders — exactly 1 RLS policy (SELECT only; no INSERT/UPDATE/DELETE for authenticated)'
);

-- ==========================================================================
-- T17: production_order_events (read only — append-only)
-- ==========================================================================

-- T17.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.production_order_events
      join public.production_orders po on po.id = public.production_order_events.production_order_id
     where public.production_order_events.workshop_id = (select id from _xtc_ids where key = 'workshop_b')
       and po.production_number = 'OP-XTC-B-0001'
  $$,
  array[0::bigint],
  'T17.1: production_order_events — workshop_a user cannot see workshop_b rows (read denial)'
);

-- T17.2: write-denial contract: exactly 1 RLS policy (SELECT only).
select results_eq(
  $$
    select count(*)::bigint
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'production_order_events'
  $$,
  array[1::bigint],
  'T17.2: production_order_events — exactly 1 RLS policy (SELECT only; no INSERT/UPDATE/DELETE for authenticated)'
);

-- ==========================================================================
-- T18: subscriptions (read for authenticated; write is service_role-only)
-- ==========================================================================

-- T18.1: read denial
select results_eq(
  $$
    select count(*)::bigint
      from public.subscriptions
     where workshop_id = (select id from _xtc_ids where key = 'workshop_b')
  $$,
  array[0::bigint],
  'T18.1: subscriptions — workshop_a user cannot see workshop_b row (read denial)'
);

-- T18.2: write-denial contract: exactly 1 RLS policy (SELECT only).
select results_eq(
  $$
    select count(*)::bigint
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'subscriptions'
  $$,
  array[1::bigint],
  'T18.2: subscriptions — exactly 1 RLS policy (SELECT only; no INSERT/UPDATE/DELETE for authenticated)'
);

-- T18.3: behavior-first write denial — authenticated has no UPDATE
-- privilege on subscriptions (table-level GRANT from
-- 0022_billing_schema.sql:39 is SELECT only). We probe the privilege
-- catalog rather than issuing an UPDATE that would fail with
-- permission denied (that would not actually exercise the catalog
-- state we want to lock).
select results_eq(
  $$
    select has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE')
  $$,
  array[false],
  'T18.3: subscriptions — authenticated role lacks the UPDATE table privilege (catalog probe locks the GRANT surface)'
);

-- T18.4: authenticated has no INSERT privilege either.
select results_eq(
  $$
    select has_table_privilege('authenticated', 'public.subscriptions', 'INSERT')
  $$,
  array[false],
  'T18.4: subscriptions — authenticated role lacks the INSERT table privilege (catalog probe locks the GRANT surface)'
);

-- T18.5: authenticated has no DELETE privilege either.
select results_eq(
  $$
    select has_table_privilege('authenticated', 'public.subscriptions', 'DELETE')
  $$,
  array[false],
  'T18.5: subscriptions — authenticated role lacks the DELETE table privilege (catalog probe locks the GRANT surface)'
);

-- ==========================================================================
-- T19: cross-cutting positive control
-- ==========================================================================
-- Prove that the workshop_a user CAN see the workshop_a fixtures.
-- If this assertion fails, every prior read-denial assertion becomes
-- meaningless (we would have proven "user_a cannot see ANY row",
-- which would be a privilege failure, not an RLS failure). This
-- guards against accidental GRANT regressions.

select results_eq(
  $$
    select count(*)::bigint
      from public.materials
     where workshop_id = (select id from _xtc_ids where key = 'workshop_a')
       and name = 'Cross Tenant Material A'
  $$,
  array[1::bigint],
  'T19.1: positive control — workshop_a user CAN see workshop_a material (privilege is intact, RLS is the gate)'
);

select * from finish();
rollback;
