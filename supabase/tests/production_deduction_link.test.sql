-- Test: production_orders ↔ quote_production_stock_deductions linkage (PR 4)
--
-- Verifies the PR-4 deliverable for the production-order-state-machine change:
--   1. quote_production_stock_deductions has a nullable
--      production_order_id FK column with ON DELETE SET NULL.
--   2. The FK is enforced by the FK constraint AND a same-workshop
--      check trigger (defense in depth, like production_order_events).
--   3. start_production_order (PR 4 version) creates a deduction batch
--      with a non-null production_order_id pointing at the new order
--      when p_create_deduction = true (default for the new flow).
--   4. start_production_order with p_create_deduction = false does NOT
--      create a deduction batch (legacy / tests that need the RPC behavior
--      in isolation).
--   5. Legacy start_quote_production keeps creating deduction batches
--      with production_order_id = NULL (backward compatibility).
--   6. Cross-workshop FK insertion is rejected with 23503 (FK constraint)
--      or 23514 (same-workshop check trigger).
--   7. RLS scopes the new column by workshop (existing policies on
--      quote_production_stock_deductions use workshop_id =
--      get_current_workshop_id()).
--   8. ON DELETE SET NULL: deleting a production_order nullifies the
--      referencing batch's production_order_id (so the legacy batch
--      remains readable in the ledger).
--   9. Idempotency: a retry of start_production_order with the same
--      p_request_id does not create a duplicate deduction batch.
--
-- All assertions are deterministic. The test seeds its own data in
-- temporary tables and reseeds rows so it does not depend on prior
-- migration state.

begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _ded_link_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _ded_link_ids (key, id) values
  -- Workshops
  ('workshop_a', 'aa000000-0000-0000-0000-0000000000a1'),
  ('workshop_b', 'bb000000-0000-0000-0000-0000000000b1'),
  -- Users
  ('admin_a',    'aa000000-0000-0000-0000-0000000000a2'),
  ('admin_b',    'bb000000-0000-0000-0000-0000000000b2'),
  ('viewer_a',   'aa000000-0000-0000-0000-0000000000a3'),
  -- Material (for legacy start_quote_production happy path)
  ('material_a', 'aa000000-0000-0000-0000-00000000a001'),
  -- Quotes
  ('quote_a_new',  'aa000000-0000-0000-0000-00000000a002'),
  ('quote_a_legacy','aa000000-0000-0000-0000-00000000a003'),
  ('quote_a_skip', 'aa000000-0000-0000-0000-00000000a004'),
  ('quote_b_new',  'bb000000-0000-0000-0000-00000000b001'),
  -- Recipe snapshot (for start_quote_production BOM consumption)
  ('snapshot_a',  'aa000000-0000-0000-0000-00000000a005'),
  -- Pre-PR-4 legacy deduction batch (simulating data that already exists
  -- before the migration runs — production_order_id is NULL)
  ('legacy_batch_a', 'aa000000-0000-0000-0000-00000000a006'),
  -- A pre-existing production order for ON DELETE SET NULL test
  ('order_a',     'aa000000-0000-0000-0000-00000000a007'),
  -- A pre-existing workshop_b production order for the cross-workshop FK
  -- test (T9.1). The id is referenced directly in T9.1 to avoid RLS
  -- filtering (the workshop_b order is invisible to admin_a's session).
  ('order_b',     'bb000000-0000-0000-0000-00000000b001');

grant select on _ded_link_ids to authenticated;

-- Seed two workshops
insert into public.workshops (id, name) values
  ((select id from _ded_link_ids where key = 'workshop_a'), 'Ded Link Test Workshop A'),
  ((select id from _ded_link_ids where key = 'workshop_b'), 'Ded Link Test Workshop B');

-- Seed auth users
insert into auth.users (id, email) values
  ((select id from _ded_link_ids where key = 'admin_a'),  'ded-link-admin-a@example.com'),
  ((select id from _ded_link_ids where key = 'admin_b'),  'ded-link-admin-b@example.com'),
  ((select id from _ded_link_ids where key = 'viewer_a'), 'ded-link-viewer-a@example.com');

-- Assign profiles
update public.profiles set workshop_id = (select id from _ded_link_ids where key = 'workshop_a')
  where id in (
    (select id from _ded_link_ids where key = 'admin_a'),
    (select id from _ded_link_ids where key = 'viewer_a')
  );

update public.profiles set workshop_id = (select id from _ded_link_ids where key = 'workshop_b')
  where id = (select id from _ded_link_ids where key = 'admin_b');

update public.profiles set workshop_role = 'admin'
  where id in (
    (select id from _ded_link_ids where key = 'admin_a'),
    (select id from _ded_link_ids where key = 'admin_b')
  );

update public.profiles set workshop_role = 'viewer'
  where id = (select id from _ded_link_ids where key = 'viewer_a');

-- Seed a material for the legacy start_quote_production path
insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values (
  (select id from _ded_link_ids where key = 'material_a'),
  (select id from _ded_link_ids where key = 'workshop_a'),
  'Ded Link Test Material', 'madera', 'un', 10, 100, 0
);

-- Seed quotes
insert into public.quotes (id, workshop_id, quote_number, furniture_name, status) values
  ((select id from _ded_link_ids where key = 'quote_a_new'),
   (select id from _ded_link_ids where key = 'workshop_a'),
   'DED-LINK-A-NEW', 'Ded Link Test Furniture A (new flow)', 'aprobado'),
  ((select id from _ded_link_ids where key = 'quote_a_legacy'),
   (select id from _ded_link_ids where key = 'workshop_a'),
   'DED-LINK-A-LEG', 'Ded Link Test Furniture A (legacy)', 'aprobado'),
  ((select id from _ded_link_ids where key = 'quote_a_skip'),
   (select id from _ded_link_ids where key = 'workshop_a'),
   'DED-LINK-A-SKP', 'Ded Link Test Furniture A (skip)', 'aprobado'),
  ((select id from _ded_link_ids where key = 'quote_b_new'),
   (select id from _ded_link_ids where key = 'workshop_b'),
   'DED-LINK-B-NEW', 'Ded Link Test Furniture B (new flow)', 'aprobado');

-- Seed a recipe snapshot for the legacy start_quote_production path
-- (needed so the BOM consumption succeeds)
insert into public.quote_recipe_snapshots (id, workshop_id, quote_id, material_id, material_name, material_unit, material_category, quantity, waste_pct, price_per_unit)
values (
  (select id from _ded_link_ids where key = 'snapshot_a'),
  (select id from _ded_link_ids where key = 'workshop_a'),
  (select id from _ded_link_ids where key = 'quote_a_legacy'),
  (select id from _ded_link_ids where key = 'material_a'),
  'Ded Link Test Material', 'un', 'madera', 5, 0, 10
);

-- Seed a pre-PR-4 legacy deduction batch. This simulates a row that
-- existed BEFORE the PR-4 migration added the production_order_id
-- column. The new column is added with a NULL default, so the legacy
-- batch keeps production_order_id = NULL. (This is the "Legacy batch
-- keeps null" scenario in the spec.)
insert into public.quote_production_stock_deductions (
  id, workshop_id, quote_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _ded_link_ids where key = 'legacy_batch_a'),
  (select id from _ded_link_ids where key = 'workshop_a'),
  (select id from _ded_link_ids where key = 'quote_a_legacy'),
  'completed',
  true, false, false,
  '[]'::jsonb,
  (select id from _ded_link_ids where key = 'admin_a')
);

-- Seed a pre-existing production order for the ON DELETE SET NULL test
-- (the order must exist before we link a batch to it)
insert into public.production_orders (
  id, workshop_id, quote_id, production_number, state
) values (
  (select id from _ded_link_ids where key = 'order_a'),
  (select id from _ded_link_ids where key = 'workshop_a'),
  (select id from _ded_link_ids where key = 'quote_a_skip'),
  'OP-DED-LINK-A-001',
  'planned'::public.production_order_state
);

-- Seed a workshop_b production order for the cross-workshop FK check
-- test (T9.1). This order must exist so the SELECT in T9.1 returns a
-- non-null production_order_id, exposing the same-workshop check trigger.
insert into public.production_orders (
  id, workshop_id, quote_id, production_number, state
) values (
  (select id from _ded_link_ids where key = 'order_b'),
  (select id from _ded_link_ids where key = 'workshop_b'),
  (select id from _ded_link_ids where key = 'quote_b_new'),
  'OP-DED-LINK-B-001',
  'planned'::public.production_order_state
);

-- ==========================================================================
-- Helper: switch to an authenticated user
-- ==========================================================================
create or replace function _ded_link_set_user(p_key text)
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
    (select id::text from _ded_link_ids where key = p_key),
    true);
end;
$$;

-- ==========================================================================
-- T1: Column existence, nullability, FK type
-- ==========================================================================

-- T1.1: production_order_id column exists
select has_column(
  'public', 'quote_production_stock_deductions', 'production_order_id',
  'T1.1: quote_production_stock_deductions has production_order_id column'
);

-- T1.2: column is nullable (legacy compatibility)
select ok(
  (
    select is_nullable = 'YES'
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'quote_production_stock_deductions'
       and column_name = 'production_order_id'
  ),
  'T1.2: production_order_id is nullable (legacy batches keep null)'
);

-- T1.3: column type is uuid
select col_type_is(
  'public', 'quote_production_stock_deductions', 'production_order_id', 'uuid',
  'T1.3: production_order_id is uuid'
);

-- ==========================================================================
-- T2: FK constraint to production_orders
-- ==========================================================================

-- T2.1: FK constraint to production_orders(id) exists, bound to the
-- production_order_id column on the deduction table. The key_column_usage
-- join makes the constrained column explicit (otherwise the count
-- assertion could match a different FK on the same target table).
select ok(
  (
    select count(*) > 0
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.table_schema = ccu.constraint_schema
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.constraint_schema
     where tc.table_schema = 'public'
       and tc.table_name = 'quote_production_stock_deductions'
       and tc.constraint_type = 'FOREIGN KEY'
       and ccu.table_name = 'production_orders'
       and ccu.column_name = 'id'
       and kcu.column_name = 'production_order_id'
  ),
  'T2.1: quote_production_stock_deductions.production_order_id has FK to production_orders(id) (constrained column explicitly bound to production_order_id)'
);

-- T2.2: ON DELETE SET NULL is configured (legacy batches survive order deletion)
select ok(
  (
    select rc.delete_rule = 'SET NULL'
      from information_schema.referential_constraints rc
      join information_schema.table_constraints tc
        on rc.constraint_name = tc.constraint_name
       and rc.constraint_schema = tc.constraint_schema
     where tc.table_schema = 'public'
       and tc.table_name = 'quote_production_stock_deductions'
       and tc.constraint_type = 'FOREIGN KEY'
       and tc.constraint_name in (
         select ccu.constraint_name
           from information_schema.constraint_column_usage ccu
          where ccu.table_schema = 'public'
            and ccu.table_name = 'production_orders'
            and ccu.column_name = 'id'
       )
  ),
  'T2.2: FK uses ON DELETE SET NULL so legacy batches survive order deletion'
);

-- ==========================================================================
-- T3: Same-workshop FK check trigger (defense in depth)
-- ==========================================================================

-- T3.1: a same-workshop FK check trigger function exists for the deduction table
select ok(
  (
    select count(*) > 0
      from pg_proc p
      join pg_namespace n on p.pronamespace = n.oid
     where n.nspname = 'public'
       and p.proname LIKE '%production_deduction%same_workshop%'
  ),
  'T3.1: a same-workshop FK check trigger function exists for quote_production_stock_deductions'
);

-- T3.2: the trigger is wired to BEFORE INSERT OR UPDATE
select ok(
  (
    select count(*) > 0
      from pg_trigger t
      join pg_class c on t.tgrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
     where n.nspname = 'public'
       and c.relname = 'quote_production_stock_deductions'
       and t.tgname LIKE '%check%production_order%same_workshop%'
       and t.tgenabled = 'O'
  ),
  'T3.2: same-workshop check trigger is enabled on quote_production_stock_deductions'
);

-- ==========================================================================
-- T4: Legacy batch keeps null (no backfill)
-- ==========================================================================

select _ded_link_set_user('admin_a');

-- T4.1: pre-existing legacy batch has production_order_id = NULL
select results_eq(
  $$select production_order_id is null
      from public.quote_production_stock_deductions
     where id = (select id from _ded_link_ids where key = 'legacy_batch_a')$$,
  $$values (true)$$,
  'T4.1: pre-existing legacy batch keeps production_order_id = NULL (no backfill)'
);

-- T4.2: legacy batch is still readable by its workshop (no FK enforcement breaks it)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where id = (select id from _ded_link_ids where key = 'legacy_batch_a')$$,
  $$values (1::int)$$,
  'T4.2: legacy batch with null production_order_id is readable (no FK enforcement breaks it)'
);

-- ==========================================================================
-- T5: New flow writes non-null FK (the headline scenario)
-- ==========================================================================

-- T5.1: start_production_order signature has the 8th parameter p_create_deduction
select has_function(
  'public', 'start_production_order',
  array['uuid', 'text', 'date', 'date', 'uuid', 'text', 'uuid', 'boolean'],
  'T5.1: start_production_order(uuid, text, date, date, uuid, text, uuid, boolean) exists (PR 4 added p_create_deduction)'
);

-- T5.2: admin_a starts a production order on quote_a_new with default p_create_deduction (true)
select _ded_link_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _ded_link_ids where key = 'quote_a_new'),
    'OP-DED-LINK-A-NEW',
    current_date,
    current_date + 7,
    null,
    'new flow order',
    'cc000000-0000-0000-0000-00000000c001'::uuid
  )$$,
  'T5.2: admin_a starts production_order on quote_a_new (new flow, default p_create_deduction=true)'
);

-- T5.3: a deduction batch was created for quote_a_new
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')$$,
  $$values (1::int)$$,
  'T5.3: new flow creates exactly one deduction batch for the quote'
);

-- T5.4: the new deduction batch has production_order_id = the new order's id
select results_eq(
  $$select (qpsd.production_order_id = po.id)
      from public.quote_production_stock_deductions qpsd
      join public.production_orders po on po.workshop_id = qpsd.workshop_id
                                     and po.quote_id = qpsd.quote_id
     where qpsd.quote_id = (select id from _ded_link_ids where key = 'quote_a_new')
     limit 1$$,
  $$values (true)$$,
  'T5.4: new deduction batch has production_order_id = the new order id (the headline scenario)'
);

-- T5.5: the new deduction batch's production_order_id is non-null
select ok(
  (
    select production_order_id IS NOT NULL
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')
     limit 1
  ),
  'T5.5: new deduction batch has production_order_id IS NOT NULL (spec requirement)'
);

-- T5.6: the new deduction batch's workshop_id matches the caller's workshop
select results_eq(
  $$select workshop_id::text
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')$$,
  $$select id::text from _ded_link_ids where key = 'workshop_a'$$,
  'T5.6: new deduction batch belongs to the caller''s workshop (RLS coverage)'
);

-- T5.7: the new deduction batch's status is 'completed' (PR 4 linkage record,
-- not a draft; BOM consumption is PR 7 territory)
select results_eq(
  $$select status::text
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')$$,
  $$values ('completed'::text)$$,
  'T5.7: new deduction batch is created in status = completed (linkage record, BOM processing is PR 7)'
);

-- ==========================================================================
-- T6: p_create_deduction = false skips the deduction batch
-- ==========================================================================

select _ded_link_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _ded_link_ids where key = 'quote_a_skip'),
    'OP-DED-LINK-A-SKIP',
    null, null, null, null,
    'cc000000-0000-0000-0000-00000000c002'::uuid,
    false  -- p_create_deduction = false
  )$$,
  'T6.1: admin_a starts production_order on quote_a_skip with p_create_deduction=false'
);

-- T6.2: NO deduction batch was created for quote_a_skip
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  $$values (0::int)$$,
  'T6.2: p_create_deduction=false does NOT create a deduction batch (backward compat with PR 2 tests)'
);

-- T6.3: the production order was still created (RPC behavior intact)
select results_eq(
  $$select state::text
      from public.production_orders
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')
       and production_number = 'OP-DED-LINK-A-SKIP'$$,
  $$values ('planned'::text)$$,
  'T6.3: p_create_deduction=false still creates the production_order (RPC behavior intact)'
);

-- ==========================================================================
-- T7: Legacy start_quote_production keeps producing batches with null FK
-- ==========================================================================

select _ded_link_set_user('admin_a');

-- T7.1: start_quote_production on quote_a_legacy hits the existing-batch branch
-- (the legacy_batch_a already exists for this quote). It returns the
-- existing batch without creating a new one.
select lives_ok(
  $$select public.start_quote_production(
    (select id from _ded_link_ids where key = 'quote_a_legacy'),
    true,
    'cc000000-0000-0000-0000-00000000c003'::uuid
  )$$,
  'T7.1: start_quote_production (legacy) is idempotent on the existing batch'
);

-- T7.2: the existing legacy batch still has production_order_id = NULL
select results_eq(
  $$select production_order_id is null
      from public.quote_production_stock_deductions
     where id = (select id from _ded_link_ids where key = 'legacy_batch_a')$$,
  $$values (true)$$,
  'T7.2: existing legacy batch keeps production_order_id = NULL after legacy start_quote_production call (no backfill)'
);

-- T7.3: only one batch exists for quote_a_legacy (no duplicate from the new flow)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_legacy')$$,
  $$values (1::int)$$,
  'T7.3: only one batch exists for the quote (legacy + new flow do not collide on the unique (workshop_id, quote_id) constraint)'
);

-- ==========================================================================
-- T8: Idempotency on p_request_id
-- ==========================================================================

select _ded_link_set_user('admin_a');

-- T8.1: retry start_production_order with the SAME p_request_id from T5
select lives_ok(
  $$select public.start_production_order(
    (select id from _ded_link_ids where key = 'quote_a_new'),
    'OP-DED-LINK-A-NEW-IDEMP',
    null, null, null, null,
    'cc000000-0000-0000-0000-00000000c001'::uuid  -- same p_request_id as T5
  )$$,
  'T8.1: retry start_production_order with the same p_request_id returns success (idempotent)'
);

-- T8.2: still exactly one deduction batch for quote_a_new (no duplicate)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')$$,
  $$values (1::int)$$,
  'T8.2: idempotent retry did NOT create a duplicate deduction batch'
);

-- ==========================================================================
-- T9: Cross-workshop safety (FK check trigger)
-- ==========================================================================

-- T9.1: a direct INSERT with a cross-workshop production_order_id is rejected
-- (the same-workshop check trigger raises 23514 even when RLS would allow it)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);

-- Sanity check: a workshop_b production order exists for the cross-workshop FK test
-- (we use reset role to bypass RLS so we can read the workshop_b row).
select ok(
  (
    select workshop_id::text
      from public.production_orders
     where id = (select id from _ded_link_ids where key = 'order_b')
  ) = (select id::text from _ded_link_ids where key = 'workshop_b'),
  'T9.0: setup — the order_b production order is in workshop_b (cross-workshop FK test fixture)'
);

-- Create a permissive INSERT policy so we can test the trigger in isolation
-- (the production_orders RLS would block the INSERT otherwise)
drop policy if exists ded_link_test_permissive_insert on public.quote_production_stock_deductions;
create policy ded_link_test_permissive_insert
  on public.quote_production_stock_deductions for insert with check (true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _ded_link_ids where key = 'admin_a'), true);
select set_config('app.production_order_write_context', '', true);

-- This insert is for workshop_a but references a workshop_b production_order.
-- The FK constraint itself is fine (the order exists), but the same-workshop
-- check trigger must reject it. We use a direct id reference (not a SELECT)
-- so the production_order_id is non-null even though RLS hides the workshop_b
-- order from admin_a's session. We use quote_a_skip (no existing batch)
-- so the unique (workshop_id, quote_id) constraint does NOT fire first,
-- exposing the same-workshop check trigger's 23514.
select throws_ok(
  $$insert into public.quote_production_stock_deductions (
       workshop_id, quote_id, production_order_id, status,
       auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
       warning_summary, confirmed_by
     ) values (
       (select id from _ded_link_ids where key = 'workshop_a'),
       (select id from _ded_link_ids where key = 'quote_a_skip'),
       (select id from _ded_link_ids where key = 'order_b'),
       'completed',
       true, false, false, '[]'::jsonb,
       (select id from _ded_link_ids where key = 'admin_a')
     )$$,
  '23514',
  null,
  'T9.1: cross-workshop production_order_id INSERT is rejected by the same-workshop check trigger (defense in depth)'
);

-- Cleanup the permissive policy so other tests in this run aren't affected
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
drop policy ded_link_test_permissive_insert on public.quote_production_stock_deductions;

-- ==========================================================================
-- T9.2-T9.4b: UPDATE corruption paths for the same-workshop check trigger
--
-- PR 4 review (incident-audit, 2026-06-30 23:25) noted that the trigger
-- is wired to `BEFORE INSERT OR UPDATE OF production_order_id, workshop_id`
-- but the test file only exercised the INSERT path. This block closes
-- that coverage gap by proving:
--   - T9.2: a direct UPDATE of production_order_id to a cross-workshop
--     order is rejected with 23514 (the trigger fires on UPDATE OF
--     production_order_id).
--   - T9.3: a direct UPDATE of workshop_id to a foreign workshop is
--     rejected with 23514 (the trigger fires on UPDATE OF workshop_id;
--     production_order_id is unchanged but the parent's workshop no
--     longer matches NEW.workshop_id).
--   - T9.4: an UPDATE of an unrelated column (warning_summary) does NOT
--     fire the same-workshop check trigger (the trigger is scoped to
--     production_order_id and workshop_id only).
-- ==========================================================================

-- T9.1b: setup — insert a fresh workshop_a batch linked to order_a (workshop_a)
-- (we need a non-null production_order_id to exercise the UPDATE OF
-- production_order_id trigger; the trigger only fires when the new
-- production_order_id is non-null per check_production_deduction_
-- production_order_same_workshop's "IF NEW.production_order_id IS NULL
-- THEN RETURN NEW" guard).
-- quote_a_skip is still empty at this point (T6.2 was p_create_deduction=false,
-- T9.1 was rejected), so we can insert a fresh batch on quote_a_skip.
-- We use service role (reset role) to bypass RLS for the setup insert.
insert into public.quote_production_stock_deductions (
  workshop_id, quote_id, production_order_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _ded_link_ids where key = 'workshop_a'),
  (select id from _ded_link_ids where key = 'quote_a_skip'),
  (select id from _ded_link_ids where key = 'order_a'),
  'completed',
  true, false, false,
  '{"note": "setup for UPDATE tests"}'::jsonb,
  (select id from _ded_link_ids where key = 'admin_a')
);

-- Recreate a permissive UPDATE policy so we can test the trigger in
-- isolation (production_orders RLS would block the UPDATE otherwise)
drop policy if exists ded_link_test_permissive_update on public.quote_production_stock_deductions;
create policy ded_link_test_permissive_update
  on public.quote_production_stock_deductions for update
  using (true) with check (true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _ded_link_ids where key = 'admin_a'), true);
select set_config('app.production_order_write_context', '', true);

-- T9.2: cross-workshop UPDATE of production_order_id is rejected
-- (the BEFORE UPDATE OF production_order_id trigger fires; v_parent_workshop_id
--  resolves to workshop_b (the new order's workshop) which is DISTINCT FROM
--  NEW.workshop_id (workshop_a) -> 23514)
select throws_ok(
  $$update public.quote_production_stock_deductions
      set production_order_id = (select id from _ded_link_ids where key = 'order_b')
    where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  '23514',
  null,
  'T9.2: cross-workshop UPDATE of production_order_id is rejected by the same-workshop check trigger (defense in depth on UPDATE OF production_order_id)'
);

-- T9.3: UPDATE of workshop_id to a foreign workshop is rejected
-- (the BEFORE UPDATE OF workshop_id trigger fires; production_order_id is
--  still order_a (workshop_a), but NEW.workshop_id is now workshop_b
--  which is DISTINCT FROM the parent order's workshop -> 23514)
select throws_ok(
  $$update public.quote_production_stock_deductions
      set workshop_id = (select id from _ded_link_ids where key = 'workshop_b')
    where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  '23514',
  null,
  'T9.3: UPDATE of workshop_id to a foreign workshop is rejected by the same-workshop check trigger (defense in depth on UPDATE OF workshop_id)'
);

-- T9.4: UPDATE of an unrelated column does NOT fire the same-workshop
-- check trigger. The trigger is wired to UPDATE OF production_order_id,
-- workshop_id — not "BEFORE UPDATE". An unrelated column update must
-- be accepted so legitimate metadata updates aren't blocked.
select lives_ok(
  $$update public.quote_production_stock_deductions
      set warning_summary = '{"note": "unrelated update succeeded"}'::jsonb
    where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  'T9.4: UPDATE of an unrelated column (warning_summary) does NOT fire the same-workshop check trigger (trigger is scoped to production_order_id, workshop_id)'
);

-- T9.4b: the unrelated update was actually persisted (proves the UPDATE
-- ran end-to-end, not just skipped silently). This triangulates T9.4:
-- lives_ok only proves the call didn't throw; the results_eq proves the
-- new warning_summary was written to the row.
select results_eq(
  $$select warning_summary
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  $$values ('{"note": "unrelated update succeeded"}'::jsonb)$$,
  'T9.4b: the unrelated UPDATE (warning_summary) was actually persisted (triangulates T9.4 — proves the UPDATE ran, not just skipped silently)'
);

-- Cleanup: drop the permissive UPDATE policy and remove the setup batch
-- so T11.0 (which expects 0 batches on quote_a_skip) still passes.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
drop policy if exists ded_link_test_permissive_update on public.quote_production_stock_deductions;
delete from public.quote_production_stock_deductions
 where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip');

-- ==========================================================================
-- T10: RLS scoping — the new column is covered by the existing policies
-- ==========================================================================

-- T10.1: as admin_b, the workshop_a deduction batches are NOT visible
select _ded_link_set_user('admin_b');

select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')$$,
  $$values (0::int)$$,
  'T10.1: workshop_b cannot see workshop_a''s deduction batches (RLS scopes by workshop_id)'
);

-- T10.2: as admin_a, the new column is readable (existing SELECT policy)
select _ded_link_set_user('admin_a');

select lives_ok(
  $$select production_order_id
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_new')
     limit 1$$,
  'T10.2: workshop_a can read the production_order_id column (existing SELECT policy covers the new column)'
);

-- ==========================================================================
-- T11: ON DELETE SET NULL
-- ==========================================================================

-- T11.0: setup check — quote_a_skip has no batch yet (T6.2 left zero rows)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  $$values (0::int)$$,
  'T11.0: setup check — quote_a_skip has no batch yet (T6.2 left zero rows, T9.1 was rejected)'
);

-- Insert a deduction batch linked to the pre-existing order_a (quote_a_skip
-- has no batch because of T6.2). This is the setup for the ON DELETE SET
-- NULL test.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
insert into public.quote_production_stock_deductions (
  workshop_id, quote_id, production_order_id, status,
  auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
  warning_summary, confirmed_by
) values (
  (select id from _ded_link_ids where key = 'workshop_a'),
  (select id from _ded_link_ids where key = 'quote_a_skip'),
  (select id from _ded_link_ids where key = 'order_a'),
  'completed',
  true, false, false,
  '[]'::jsonb,
  (select id from _ded_link_ids where key = 'admin_a')
);

-- T11.1: the batch is linked to the pre-existing order
select results_eq(
  $$select (qpsd.production_order_id = (select id from _ded_link_ids where key = 'order_a'))::text
      from public.quote_production_stock_deductions qpsd
     where qpsd.quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')
     limit 1$$,
  $$values (true::text)$$,
  'T11.1: setup — quote_a_skip has a deduction batch linked to the pre-existing order_a'
);

-- T11.2: delete the production order → FK ON DELETE SET NULL fires
delete from public.production_orders
 where id = (select id from _ded_link_ids where key = 'order_a');

-- T11.3: the deduction batch's production_order_id is now NULL
select results_eq(
  $$select production_order_id is null
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')
     limit 1$$,
  $$values (true)$$,
  'T11.3: after deleting the production order, the deduction batch''s production_order_id is SET NULL (legacy ledger remains readable)'
);

-- T11.4: the batch row itself still exists (the deletion only nullified the FK)
select results_eq(
  $$select count(*)::int
      from public.quote_production_stock_deductions
     where quote_id = (select id from _ded_link_ids where key = 'quote_a_skip')$$,
  $$values (1::int)$$,
  'T11.4: the deduction batch row still exists after the order deletion (only the FK was nullified)'
);

-- ==========================================================================
-- T12: Index exists on (workshop_id, production_order_id)
-- ==========================================================================

select has_index(
  'public', 'quote_production_stock_deductions',
  'idx_production_deductions_workshop_production_order',
  array['workshop_id', 'production_order_id'],
  'T12: index on (workshop_id, production_order_id) exists for the new column'
);

rollback;
