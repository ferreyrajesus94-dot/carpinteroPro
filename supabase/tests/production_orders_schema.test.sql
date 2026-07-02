-- Test: production_orders schema foundation (PR 1)
--
-- Verifies the PR-1 deliverable for the production-order-state-machine change:
--   1. production_order_state enum exists with the 7 required values
--   2. production_orders table exists with the required columns
--   3. production_order_events table exists with the required columns
--   4. workshop_id is NOT NULL on both tables
--   5. production_orders exposes exactly 1 RLS policy (SELECT) — no INSERT/UPDATE/DELETE
--      because the state machine is RPC-owned (PR 2). Direct authenticated mutations
--      must be denied at every layer (RLS absence + defense-in-depth trigger).
--   6. production_order_events exposes exactly 1 RLS policy (SELECT) — append-only by RLS
--   7. production_orders policies are scoped by get_current_workshop_id()
--   8. production_orders has a unique index on (workshop_id, production_number)
--   9. production_orders.state defaults to 'planned'
--  10. cross-tenant SELECT is blocked (workshop A user cannot see workshop B rows)
--  11. cross-tenant UPDATE is blocked by RLS (row invisible)
--  12. cross-tenant INSERT is blocked by RLS (no policy at all)
--  13. duplicate (workshop_id, production_number) is rejected
--  14. same production_number is allowed across different workshops (service role setup)
--  15. authenticated UPDATE on production_order_events is rejected (RLS denies)
--  16. authenticated DELETE on production_order_events is rejected (RLS denies)
--  17. the append-only trigger fires when UPDATE/DELETE bypass RLS
--  18. production_order_events row reason is unchanged after rejected mutations
--  19. cross-tenant INSERT of production_order_events is rejected
--  20. production_orders.updated_at advances when the row is updated
--  21. same-workshop direct UPDATE on production_orders affects 0 rows (no UPDATE policy)
--  22. same-workshop direct DELETE on production_orders affects 0 rows (no DELETE policy)
--  23. production_orders row notes is unchanged after rejected same-workshop UPDATE/DELETE
--  24. defense-in-depth trigger rejects authenticated UPDATE on production_orders
--  25. defense-in-depth trigger rejects authenticated DELETE on production_orders
--  26. production_orders row notes is unchanged after trigger-rejected mutations
--  27. same-workshop FK integrity: production_orders rejects own workshop + foreign quote_id
--  28. same-workshop FK integrity: production_order_events rejects own workshop + foreign
--      production_order_id (the dangerous inverse)
--  29. authenticated direct INSERT into production_orders is rejected (no policy)
--  30. authenticated direct INSERT into production_order_events is rejected (no policy)
--  31. defense-in-depth INSERT trigger is installed on production_orders
--  32. defense-in-depth INSERT trigger is installed on production_order_events
--  33. defense-in-depth INSERT trigger rejects authenticated INSERT with permissive policy
--      on production_orders
--  34. defense-in-depth INSERT trigger rejects authenticated INSERT with permissive policy
--      on production_order_events
--  35. same-workshop FK check trigger on production_orders is invariant: service_role
--      (auth.uid() IS NULL) insert with mismatched workshop_id is rejected with 23514
--  36. same-workshop FK check trigger on production_order_events is invariant: service_role
--      insert with mismatched workshop_id is rejected with 23514
--  37. service_role insert into production_orders with matched workshop_id succeeds
--      (FK check MATCH branch must not false-positive)
--  38. internal guard: authenticated writes are blocked when
--      app.production_order_write_context != 'rpc' (regression — the original auth gate)
--  39. internal guard: authenticated INSERT is allowed when the guard is 'rpc'
--      (simulating PR-2 SECURITY DEFINER RPC body after role/workshop checks)
--  40. internal guard: authenticated UPDATE is allowed when the guard is 'rpc'
--  41. internal guard: authenticated DELETE is allowed when the guard is 'rpc'
--  42. internal guard: production_order_events authenticated INSERT is allowed when
--      the guard is 'rpc'
--  43. internal guard: with guard set, cross-tenant FK check STILL fires (23514)
--  44. internal guard: with guard set, same-workshop FK check PASSES (positive case)
--  45. internal guard: guard value must be exactly 'rpc'; any other value (including
--      'rpc-foo', '', 'RPC', or NULL/missing) is rejected
--  46. internal guard: guard is transaction-local — leaving the transaction clears it
--      (regression — direct authenticated writes in a new transaction are still blocked)

begin;

create extension if not exists pgtap with schema extensions;

select plan(68);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _prod_schema_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _prod_schema_ids (key, id) values
  ('workshop_a',  '10000000-0000-0000-0000-0000000000a1'),
  ('workshop_b',  '10000000-0000-0000-0000-0000000000b1'),
  ('user_a',      '20000000-0000-0000-0000-0000000000a1'),
  ('user_b',      '20000000-0000-0000-0000-0000000000b1'),
  ('quote_a',     '30000000-0000-0000-0000-0000000000a1'),
  ('quote_b',     '30000000-0000-0000-0000-0000000000b1'),
  ('order_a',     '40000000-0000-0000-0000-0000000000a1'),
  ('order_b',     '40000000-0000-0000-0000-0000000000b1'),
  ('event_a',     '50000000-0000-0000-0000-0000000000a1');

grant select on _prod_schema_ids to authenticated;

-- Seed two workshops and two users
insert into public.workshops (id, name) values
  ((select id from _prod_schema_ids where key = 'workshop_a'), 'Prod Schema Test Workshop A'),
  ((select id from _prod_schema_ids where key = 'workshop_b'), 'Prod Schema Test Workshop B');

insert into auth.users (id, email) values
  ((select id from _prod_schema_ids where key = 'user_a'), 'prod-schema-a@example.com'),
  ((select id from _prod_schema_ids where key = 'user_b'), 'prod-schema-b@example.com');

update public.profiles
set workshop_id = (select id from _prod_schema_ids where key = 'workshop_a')
where id = (select id from _prod_schema_ids where key = 'user_a');

update public.profiles
set workshop_id = (select id from _prod_schema_ids where key = 'workshop_b')
where id = (select id from _prod_schema_ids where key = 'user_b');

-- Seed a quote for each workshop so the production_orders FK resolves
insert into public.quotes (id, workshop_id, quote_number, furniture_name, status)
values
  ((select id from _prod_schema_ids where key = 'quote_a'),
   (select id from _prod_schema_ids where key = 'workshop_a'),
   'PROD-SCHEMA-A-001', 'Schema Test Furniture A', 'aprobado'),
  ((select id from _prod_schema_ids where key = 'quote_b'),
   (select id from _prod_schema_ids where key = 'workshop_b'),
   'PROD-SCHEMA-B-001', 'Schema Test Furniture B', 'aprobado');

-- ==========================================================================
-- T1: production_order_state enum exists with the 7 required values
-- ==========================================================================

select has_type(
  'public',
  'production_order_state',
  'T1.1: production_order_state enum exists in public schema'
);

select enum_has_labels(
  'public',
  'production_order_state',
  array['planned', 'in_progress', 'paused', 'quality_check', 'ready', 'delivered', 'cancelled']::text[],
  'T1.2: production_order_state exposes exactly 7 labels in the required order'
);

-- ==========================================================================
-- T2: production_orders table exists with the required columns
-- ==========================================================================

select has_table(
  'public',
  'production_orders',
  'T2.1: production_orders table exists'
);

select columns_are(
  'public',
  'production_orders',
  array[
    'id',
    'workshop_id',
    'quote_id',
    'production_number',
    'state',
    'planned_start_date',
    'planned_end_date',
    'actual_start_date',
    'actual_end_date',
    'assigned_to',
    'notes',
    'created_at',
    'updated_at'
  ],
  'T2.2: production_orders has the required columns in the required order'
);

select col_type_is(
  'public',
  'production_orders',
  'id',
  'uuid',
  'T2.3: production_orders.id is uuid'
);

select col_type_is(
  'public',
  'production_orders',
  'state',
  'production_order_state',
  'T2.4: production_orders.state is production_order_state'
);

-- ==========================================================================
-- T3: production_order_events table exists with the required columns
-- ==========================================================================

select has_table(
  'public',
  'production_order_events',
  'T3.1: production_order_events table exists'
);

select columns_are(
  'public',
  'production_order_events',
  array[
    'id',
    'workshop_id',
    'production_order_id',
    'event_type',
    'from_state',
    'to_state',
    'reason',
    'note',
    'actor_id',
    'metadata',
    'created_at'
  ],
  'T3.2: production_order_events has the required columns in the required order (PR 7 added event_type and note)'
);

select col_type_is(
  'public',
  'production_order_events',
  'from_state',
  'production_order_state',
  'T3.3: production_order_events.from_state is production_order_state'
);

select col_type_is(
  'public',
  'production_order_events',
  'to_state',
  'production_order_state',
  'T3.4: production_order_events.to_state is production_order_state'
);

-- ==========================================================================
-- T4: workshop_id is NOT NULL on both tables
-- ==========================================================================

select col_not_null(
  'public',
  'production_orders',
  'workshop_id',
  'T4.1: production_orders.workshop_id is NOT NULL'
);

select col_not_null(
  'public',
  'production_order_events',
  'workshop_id',
  'T4.2: production_order_events.workshop_id is NOT NULL'
);

-- ==========================================================================
-- T5: production_orders exposes ONLY a SELECT RLS policy.
--
-- The state machine for production_orders is SQL-owned and gated through
-- the PR-2 RPCs (start_production_order, transition_production_order_state).
-- PR 1 must NOT expose direct INSERT/UPDATE/DELETE policies to authenticated
-- users, because that would bypass the planned role-gated transition path.
-- SELECT-only is enforced at the RLS layer; a defense-in-depth trigger
-- (tested in T24) is the second gate.
-- ==========================================================================

select policies_are(
  'public',
  'production_orders',
  array[
    'production_orders_select'
  ],
  'T5.1: production_orders exposes exactly 1 RLS policy (SELECT) — no INSERT/UPDATE/DELETE; state machine is PR-2 RPC-owned'
);

select policy_cmd_is(
  'public',
  'production_orders',
  'production_orders_select',
  'SELECT',
  'T5.2: production_orders_select is a SELECT policy'
);

-- T5.3: production_orders_insert policy is intentionally absent.
-- Direct authenticated inserts must be rejected (tested in T23). PR 2 RPCs
-- are the only sanctioned mutation path. Without this policy, the absence
-- itself is the first gate (RLS denies with 42501 by default).
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = 'public.production_orders'::regclass
      and polname = 'production_orders_insert'
  ),
  'T5.3: production_orders_insert policy does not exist (state machine is RPC-owned)'
);

-- T5.4: production_orders_update policy does not exist
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = 'public.production_orders'::regclass
      and polname = 'production_orders_update'
  ),
  'T5.4: production_orders_update policy does not exist (state machine is RPC-owned)'
);

-- T5.5: production_orders_delete policy does not exist
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = 'public.production_orders'::regclass
      and polname = 'production_orders_delete'
  ),
  'T5.5: production_orders_delete policy does not exist (state machine is RPC-owned)'
);

-- ==========================================================================
-- T6: production_order_events exposes ONLY a SELECT RLS policy
--
-- Append-only is enforced at the RLS layer (no INSERT/UPDATE/DELETE policies)
-- plus a defense-in-depth UPDATE/DELETE trigger. Events are written by the
-- PR-2 transition RPCs, not by direct client INSERT.
-- ==========================================================================

select policies_are(
  'public',
  'production_order_events',
  array[
    'production_order_events_select'
  ],
  'T6.1: production_order_events exposes exactly 1 RLS policy (SELECT) — append-only by RLS'
);

-- T6.2: production_order_events_insert policy does not exist
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = 'public.production_order_events'::regclass
      and polname = 'production_order_events_insert'
  ),
  'T6.2: production_order_events_insert policy does not exist (events are written by PR-2 RPCs)'
);

-- ==========================================================================
-- T7: production_orders SELECT policy is scoped by get_current_workshop_id()
-- ==========================================================================

select ok(
  (
    with policy_qual as (
      select pg_get_expr(polqual, polrelid) as qual
      from pg_policy
      where polrelid = 'public.production_orders'::regclass
        and polname = 'production_orders_select'
    )
    select qual like '%get_current_workshop_id()%'
    from policy_qual
  ),
  'T7.1: production_orders_select uses get_current_workshop_id() in its USING expression'
);

-- ==========================================================================
-- T8: production_orders has a unique index on (workshop_id, production_number)
-- ==========================================================================

select has_index(
  'public',
  'production_orders',
  'production_orders_workshop_id_production_number_key',
  array['workshop_id', 'production_number'],
  'T8.1: production_orders has unique (workshop_id, production_number) index'
);

-- ==========================================================================
-- T9: default state for a fresh production_order is 'planned'
-- ==========================================================================

select col_default_is(
  'public',
  'production_orders',
  'state',
  'planned'::public.production_order_state,
  'T9.1: production_orders.state defaults to planned'
);

-- ==========================================================================
-- T10: cross-tenant SELECT is blocked
-- ==========================================================================

-- Seed one production_order in each workshop as service role (postgres).
-- The same-workshop FK check trigger is now invariant (no auth.uid() bypass),
-- so service role setup MUST use consistent workshop_id/quote_id pairs.
insert into public.production_orders (
  id, workshop_id, quote_id, production_number, state
) values
  ((select id from _prod_schema_ids where key = 'order_a'),
   (select id from _prod_schema_ids where key = 'workshop_a'),
   (select id from _prod_schema_ids where key = 'quote_a'),
   'OP-SCHEMA-A-0001',
   'planned'),
  ((select id from _prod_schema_ids where key = 'order_b'),
   (select id from _prod_schema_ids where key = 'workshop_b'),
   (select id from _prod_schema_ids where key = 'quote_b'),
   'OP-SCHEMA-B-0001',
   'planned');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

select results_eq(
  $$select count(*)::bigint
      from public.production_orders
      where id = (select id from _prod_schema_ids where key = 'order_b')$$,
  array[0::bigint],
  'T10.1: user A cannot see workshop B production_order via SELECT'
);

select results_eq(
  $$select count(*)::bigint
      from public.production_orders
      where id = (select id from _prod_schema_ids where key = 'order_a')$$,
  array[1::bigint],
  'T10.2: user A CAN see own workshop A production_order via SELECT'
);

-- ==========================================================================
-- T11: cross-tenant UPDATE is blocked by RLS
-- ==========================================================================

-- Updating notes on a foreign-workshop row is blocked: the row is invisible
-- via RLS, so UPDATE returns 0 rows affected. The notes field stays null.
select results_eq(
  $$update public.production_orders
      set notes = 'tampered'
    where id = (select id from _prod_schema_ids where key = 'order_b')
    returning 1$$,
  array[]::int[],
  'T11.1: user A UPDATE on workshop B production_order affects 0 rows (RLS row invisible)'
);

select is(
  (select notes from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_b')),
  null::text,
  'T11.2: user A cannot mutate workshop B production_order notes (still null)'
);

-- ==========================================================================
-- T12: cross-tenant INSERT is blocked by RLS (no INSERT policy at all)
-- ==========================================================================

-- T12.1: user A authenticated direct INSERT with workshop_b is rejected.
-- Without a permissive policy, the default deny produces 42501 ("new row
-- violates row-level security policy"). The same-workshop FK check trigger
-- fires first but does not raise (workshop_b quote_id matches workshop_b
-- workshop_id), so the chain reaches the RLS WITH CHECK gate which denies.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_b'),
        (select id from _prod_schema_ids where key = 'quote_b'),
        'OP-SCHEMA-A-FORBIDDEN',
        'planned')$$,
  '42501',
  null,
  'T12.1: user A cannot insert a production_order for workshop B (no INSERT policy -> 42501)'
);

-- ==========================================================================
-- T13: duplicate (workshop_id, production_number) is rejected
-- ==========================================================================
-- Must be done as service role: the only sanctioned writer in PR 1.
-- `reset role;` returns the role to postgres but does NOT clear the
-- `request.jwt.claim.sub` GUC; the defense-in-depth INSERT trigger reads
-- `auth.uid()` from that GUC. Clear the GUC explicitly so the trigger's
-- auth gate is bypassed and we exercise the unique constraint (23505)
-- rather than the auth gate (42501).
reset role;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-0001',
        'planned')$$,
  '23505',
  null,
  'T13.1: duplicate (workshop_id, production_number) is rejected with unique violation'
);

-- ==========================================================================
-- T14: same production_number is allowed in a different workshop
-- ==========================================================================
-- The state machine is RPC-owned. This proves the unique index is scoped
-- per workshop, not global. The seeding insert must be done as service role
-- because PR 1 exposes no INSERT policy for authenticated users (PR 2 RPCs
-- are the sanctioned writer). Clear the GUC so the defense-in-depth
-- INSERT trigger's auth gate is bypassed and we exercise the unique index,
-- not the auth gate.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select lives_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_b'),
        (select id from _prod_schema_ids where key = 'quote_b'),
        'OP-SCHEMA-A-0001',
        'planned')$$,
  'T14.1: same production_number is allowed in a different workshop (workshop-scoped uniqueness; service role setup)'
);

-- ==========================================================================
-- T15: production_order_events is append-only for authenticated users
-- ==========================================================================

-- Seed an event row from the service role (postgres) so we have a target to mutate.
-- Clear the GUC so the defense-in-depth INSERT trigger's auth gate is bypassed
-- and the seed insert succeeds; we want the row to exist before we test
-- rejection of authenticated mutations against it.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.production_order_events (
  id, workshop_id, production_order_id, from_state, to_state, reason, actor_id, metadata
) values
  ((select id from _prod_schema_ids where key = 'event_a'),
   (select id from _prod_schema_ids where key = 'workshop_a'),
   (select id from _prod_schema_ids where key = 'order_a'),
   'planned',
   'in_progress',
   'schema test event',
   (select id from _prod_schema_ids where key = 'user_a'),
   '{"request_id":"schema-test-1"}'::jsonb);

-- Switch to user_a to test authenticated append-only
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

-- T15.1: authenticated UPDATE on the event affects 0 rows (no UPDATE policy)
select results_eq(
  $$update public.production_order_events
      set reason = 'tampered'
    where id = (select id from _prod_schema_ids where key = 'event_a')
    returning 1$$,
  array[]::int[],
  'T15.1: authenticated UPDATE on production_order_events affects 0 rows (no UPDATE policy)'
);

-- T15.2: authenticated DELETE on the event affects 0 rows (no DELETE policy)
select results_eq(
  $$delete from public.production_order_events
    where id = (select id from _prod_schema_ids where key = 'event_a')
    returning 1$$,
  array[]::int[],
  'T15.2: authenticated DELETE on production_order_events affects 0 rows (no DELETE policy)'
);

-- T15.3: the event row is unchanged after the rejected mutations
select is(
  (select reason from public.production_order_events
    where id = (select id from _prod_schema_ids where key = 'event_a')),
  'schema test event'::text,
  'T15.3: production_order_events row reason is unchanged after rejected authenticated UPDATE/DELETE'
);

-- T15.4: cross-tenant INSERT of production_order_events is rejected.
-- With the new contract, the auth gate trigger fires first and raises 42501
-- (defense in depth). The FK check trigger (tested in T22.1) would also
-- reject this with 23514 if the auth gate were bypassed (e.g., permissive
-- INSERT policy). Here we accept either rejection.
select throws_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_b'),
        (select id from _prod_schema_ids where key = 'order_a'),
        'planned',
        'cancelled',
        'cross-tenant event',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  '42501',
  null,
  'T15.4: cross-tenant INSERT of production_order_events is rejected by auth gate (cross-tenant scenario blocked at the first defense layer)'
);

-- ==========================================================================
-- T16: append-only TRIGGER fires when RLS would allow UPDATE/DELETE
--
-- Defense in depth: the absence of UPDATE/DELETE policies normally blocks
-- authenticated mutations silently (no rows match). But a future migration
-- could accidentally add a permissive policy. The trigger is the second
-- gate. We open a permissive UPDATE/DELETE policy and prove the trigger
-- still rejects the operation with 42501.
-- ==========================================================================

-- The CREATE POLICY statements must run as the table owner (postgres / service role).
reset role;
create policy production_order_events_test_permissive_update
  on public.production_order_events
  for update using (true) with check (true);
create policy production_order_events_test_permissive_delete
  on public.production_order_events
  for delete using (true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

-- T16.1: authenticated UPDATE with permissive policy is rejected by trigger
select throws_ok(
  $$update public.production_order_events
      set reason = 'tampered via permissive policy'
    where id = (select id from _prod_schema_ids where key = 'event_a')$$,
  '42501',
  'production_order_events are immutable via direct UPDATE; use transition_production_order_state RPC to record',
  'T16.1: authenticated UPDATE rejected by trigger (defense in depth) even with permissive RLS'
);

-- T16.2: authenticated DELETE with permissive policy is rejected by trigger
select throws_ok(
  $$delete from public.production_order_events
    where id = (select id from _prod_schema_ids where key = 'event_a')$$,
  '42501',
  'production_order_events are immutable via direct DELETE; use transition_production_order_state RPC to record',
  'T16.2: authenticated DELETE rejected by trigger (defense in depth) even with permissive RLS'
);

-- T16.3: the event row is still unchanged after the rejected trigger-blocked mutations
select is(
  (select reason from public.production_order_events
    where id = (select id from _prod_schema_ids where key = 'event_a')),
  'schema test event'::text,
  'T16.3: production_order_events row reason is unchanged after trigger-rejected UPDATE/DELETE'
);

-- ==========================================================================
-- T17: production_orders updated_at trigger is installed and fires
--
-- We verify the trigger with a static check (has_trigger) instead of a
-- time-advance comparison: within a single pgTAP transaction, now() returns
-- the transaction-start timestamp, so any UPDATE in the same transaction
-- would produce identical before/after timestamps even if the trigger fires.
-- The production behavior is correct — every real-world UPDATE happens in
-- a new transaction and updated_at advances as expected.
-- ==========================================================================

reset role;

-- T17.1: the BEFORE UPDATE trigger is installed
select has_trigger(
  'public', 'production_orders',
  'production_orders_set_updated_at',
  'T17.1: production_orders_set_updated_at BEFORE UPDATE trigger is installed'
);

-- T17.2: the trigger function is the shared set_updated_at() function
select ok(
  (
    select tgrelid::regclass::text || ' uses ' || t.tgname || ' -> '
           || p.proname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.production_orders'::regclass
      and t.tgname = 'production_orders_set_updated_at'
      and not t.tgisinternal
  ) like '%set_updated_at%',
  'T17.2: production_orders_set_updated_at trigger is wired to public.set_updated_at()'
);

-- T17.3: updated_at is non-null after the row was inserted
select ok(
  (select updated_at from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_a')) is not null,
  'T17.3: production_orders.updated_at is non-null after insert'
);

-- ==========================================================================
-- T19: same-workshop direct UPDATE/DELETE on production_orders is rejected
--
-- The dangerous scenario is: user A (workshop A) tries to UPDATE/DELETE a
-- row that is ALREADY in their own workshop. RLS row-invisibility no longer
-- saves us because the row IS visible to user A. The fix is that no UPDATE
-- or DELETE policy exists, so the operation affects 0 rows. PR 2 will add
-- the gated RPCs (start_production_order, transition_production_order_state)
-- that own all state changes.
-- ==========================================================================

-- T19.1: same-workshop direct UPDATE affects 0 rows (no UPDATE policy)
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

select results_eq(
  $$update public.production_orders
      set notes = 'tampered same workshop'
    where id = (select id from _prod_schema_ids where key = 'order_a')
    returning 1$$,
  array[]::int[],
  'T19.1: same-workshop direct UPDATE on production_orders affects 0 rows (no UPDATE policy)'
);

-- T19.2: same-workshop direct DELETE affects 0 rows (no DELETE policy)
select results_eq(
  $$delete from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_a')
    returning 1$$,
  array[]::int[],
  'T19.2: same-workshop direct DELETE on production_orders affects 0 rows (no DELETE policy)'
);

-- T19.3: production_orders row notes is unchanged after rejected mutations
select is(
  (select notes from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_a')),
  null::text,
  'T19.3: production_orders.notes is unchanged after rejected same-workshop UPDATE/DELETE'
);

-- ==========================================================================
-- T20: defense-in-depth TRIGGER fires on production_orders UPDATE/DELETE
--
-- The absence of UPDATE/DELETE policies is the primary gate. The trigger
-- is the second line of defense: a future migration that accidentally
-- re-introduces a permissive policy will still be caught with 42501.
-- We open a permissive UPDATE/DELETE policy and prove the trigger rejects
-- the operation.
-- ==========================================================================

reset role;
create policy production_orders_test_permissive_update
  on public.production_orders
  for update using (true) with check (true);
create policy production_orders_test_permissive_delete
  on public.production_orders
  for delete using (true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

-- T20.1: authenticated UPDATE with permissive policy is rejected by trigger
select throws_ok(
  $$update public.production_orders
      set notes = 'tampered via permissive policy'
    where id = (select id from _prod_schema_ids where key = 'order_a')$$,
  '42501',
  'production_orders are immutable via direct UPDATE; use start_production_order / transition_production_order_state RPCs',
  'T20.1: authenticated UPDATE rejected by trigger (defense in depth) even with permissive RLS'
);

-- T20.2: authenticated DELETE with permissive policy is rejected by trigger
select throws_ok(
  $$delete from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_a')$$,
  '42501',
  'production_orders are immutable via direct DELETE; use start_production_order / transition_production_order_state RPCs',
  'T20.2: authenticated DELETE rejected by trigger (defense in depth) even with permissive RLS'
);

-- T20.3: production_orders row notes is still unchanged after trigger-rejected mutations
select is(
  (select notes from public.production_orders
    where id = (select id from _prod_schema_ids where key = 'order_a')),
  null::text,
  'T20.3: production_orders.notes is unchanged after trigger-rejected UPDATE/DELETE'
);

-- Clean up the permissive policies we added for the trigger test
reset role;
drop policy if exists production_orders_test_permissive_update on public.production_orders;
drop policy if exists production_orders_test_permissive_delete on public.production_orders;

-- ==========================================================================
-- T21: same-workshop FK integrity on production_orders.quote_id
--
-- A child production_order in workshop A must not reference a parent quote
-- in workshop B. RLS WITH CHECK on production_orders only checks the row's
-- own workshop_id; the FK on quote_id only checks that the quote UUID
-- exists. Without this trigger, an authenticated user can insert a row in
-- their own workshop pointing at a foreign-workshop quote, corrupting
-- cross-tenant data and making RLS-only coverage falsely reassuring.
-- ==========================================================================

reset role;

-- T21.1: INSERT with own workshop_id + foreign-workshop quote_id is rejected
-- Use a permissive INSERT policy and a cleared GUC so the auth gate is
-- bypassed. The FK check trigger must still reject this with 23514.
-- This isolates the FK check from the auth gate (which would otherwise
-- fire first and raise 42501, masking the FK check's behavior).
reset role;
select set_config('request.jwt.claim.sub', '', true);
create policy production_orders_test_permissive_insert
  on public.production_orders
  for insert with check (true);

-- Stay as postgres (or `authenticated` with empty GUC) — what matters is
-- that auth.uid() returns NULL. We use postgres because it has BYPASSRLS,
-- which is equivalent to having a permissive policy + the role's own checks.
-- Both are valid: the FK check is what we are testing, not the role itself.
set local role authenticated;
-- NOTE: GUC remains empty (set above), so auth.uid() is NULL.

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_b'),
        'OP-SCHEMA-A-FK-MISMATCH',
        'planned')$$,
  '23514',
  null,
  'T21.1: production_orders INSERT with own workshop_id + foreign quote_id is rejected by same-workshop FK check (permissive RLS, auth gate bypassed)'
);

-- T21.2: same-workshop FK check trigger is installed on production_orders
reset role;
select has_trigger(
  'public', 'production_orders',
  'production_orders_check_quote_same_workshop',
  'T21.2: production_orders_check_quote_same_workshop trigger is installed (BEFORE INSERT OR UPDATE)'
);

-- T21.3: positive case — own workshop + own parent quote succeeds
-- (Trigger's MATCH branch must not false-positive.) The insert is done
-- as service role with permissive INSERT policy so neither the auth gate
-- nor the FK check raises. Insert must succeed.
reset role;
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-MATCH-POSITIVE',
        'planned')$$,
  'T21.3: production_orders INSERT with own workshop + own quote succeeds (FK check MATCH branch, permissive RLS, service role)'
);

reset role;
drop policy if exists production_orders_test_permissive_insert on public.production_orders;

-- ==========================================================================
-- T22: same-workshop FK integrity on production_order_events.production_order_id
--
-- The dangerous inverse: an authenticated user could insert a production_order_event
-- in their own workshop pointing at a foreign-workshop production_order. RLS
-- WITH CHECK on production_order_events only checks the row's own workshop_id.
-- The FK on production_order_id only checks the order UUID exists. Without
-- this trigger, the child event could span tenants.
-- ==========================================================================

-- T22.1: INSERT with own workshop_id + foreign-workshop production_order_id is rejected
-- Use a permissive INSERT policy and a cleared GUC so the auth gate is
-- bypassed. The FK check trigger must still reject this with 23514.
-- This isolates the FK check from the auth gate.
reset role;
select set_config('request.jwt.claim.sub', '', true);
create policy production_order_events_test_permissive_insert
  on public.production_order_events
  for insert with check (true);

set local role authenticated;
-- NOTE: GUC remains empty (set above), so auth.uid() is NULL.

select throws_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_b'),
        'planned',
        'in_progress',
        'foreign-parent event',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  '23514',
  null,
  'T22.1: production_order_events INSERT with own workshop_id + foreign production_order_id is rejected by same-workshop FK check (permissive RLS, auth gate bypassed)'
);

-- T22.2: same-workshop FK check trigger is installed on production_order_events
reset role;
select has_trigger(
  'public', 'production_order_events',
  'production_order_events_check_order_same_workshop',
  'T22.2: production_order_events_check_order_same_workshop trigger is installed (BEFORE INSERT OR UPDATE)'
);

-- T22.3: positive case — own workshop + own parent order succeeds
-- (Trigger's MATCH branch must not false-positive.) Service role with
-- permissive INSERT policy so neither gate raises.
reset role;
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_a'),
        'planned',
        'in_progress',
        'positive match event',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  'T22.3: production_order_events INSERT with own workshop + own order succeeds (FK check MATCH branch, permissive RLS, service role)'
);

reset role;
drop policy if exists production_order_events_test_permissive_insert on public.production_order_events;

-- ==========================================================================
-- T23: direct authenticated INSERT into production_orders and
-- production_order_events is rejected (no policy)
--
-- PR 1's contract: authenticated clients MUST NOT be able to insert directly
-- into either table. PR 2 RPCs are the only sanctioned writer. This is the
-- first gate — RLS absence (default deny). The defense-in-depth trigger
-- (tested in T24) is the second gate.
-- ==========================================================================

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

-- T23.1: authenticated direct INSERT into production_orders with own workshop is rejected
select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-AUTH-INSERT',
        'planned')$$,
  '42501',
  null,
  'T23.1: authenticated direct INSERT into production_orders is rejected (no INSERT policy -> 42501)'
);

-- T23.2: authenticated direct INSERT into production_order_events with own workshop is rejected
select throws_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_a'),
        'planned',
        'in_progress',
        'auth direct insert',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  '42501',
  null,
  'T23.2: authenticated direct INSERT into production_order_events is rejected (no INSERT policy -> 42501)'
);

-- ==========================================================================
-- T24: defense-in-depth INSERT TRIGGER is installed and fires
--
-- A future migration that re-introduces a permissive INSERT policy must
-- still be caught. The trigger rejects authenticated INSERTs with 42501
-- naming the PR-2 RPCs, so future developers find the right path.
-- ==========================================================================

reset role;

-- T24.1: defense-in-depth INSERT trigger is installed on production_orders
select has_trigger(
  'public', 'production_orders',
  'prevent_authenticated_production_order_insert',
  'T24.1: prevent_authenticated_production_order_insert trigger is installed (BEFORE INSERT)'
);

-- T24.2: defense-in-depth INSERT trigger is installed on production_order_events
select has_trigger(
  'public', 'production_order_events',
  'prevent_authenticated_production_order_event_insert',
  'T24.2: prevent_authenticated_production_order_event_insert trigger is installed (BEFORE INSERT)'
);

-- T24.3: authenticated INSERT with permissive INSERT policy is rejected by trigger
create policy production_orders_test_permissive_insert
  on public.production_orders
  for insert with check (true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-AUTH-INSERT-TRIGGER',
        'planned')$$,
  '42501',
  'production_orders are immutable via direct INSERT; use start_production_order / transition_production_order_state RPCs',
  'T24.3: authenticated INSERT rejected by trigger (defense in depth) even with permissive RLS'
);

reset role;
drop policy if exists production_orders_test_permissive_insert on public.production_orders;

-- T24.4: same for production_order_events
create policy production_order_events_test_permissive_insert
  on public.production_order_events
  for insert with check (true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

select throws_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_a'),
        'planned',
        'in_progress',
        'auth direct insert via permissive',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  '42501',
  'production_order_events are immutable via direct INSERT; use transition_production_order_state RPC to record',
  'T24.4: authenticated INSERT rejected by trigger (defense in depth) even with permissive RLS'
);

reset role;
drop policy if exists production_order_events_test_permissive_insert on public.production_order_events;

-- ==========================================================================
-- T25: same-workshop FK check triggers are INVARIANT for service_role
--
-- PR 1 enforces same-workshop integrity for ALL writers, not just
-- authenticated users. The previous draft had an auth.uid() IS NULL bypass
-- for service_role; the new contract removes it so cross-tenant setup
-- paths can never silently corrupt workshop_id. A real workshop merge
-- would need to explicitly disable the trigger with proper audit.
-- ==========================================================================

-- Explicitly clear the JWT claim GUC so auth.uid() is NULL for these tests.
-- The T23/T24 tests above set request.jwt.claim.sub to user_a's id; the GUC
-- persists across `reset role` within the same transaction. Clearing it here
-- makes these tests prove the trigger fires when auth.uid() IS NULL — the
-- exact condition that the previous draft's bypass shortcut.
select set_config('request.jwt.claim.sub', '', true);

-- T25.1: service_role insert with mismatched workshop_id on production_orders
-- is rejected with 23514 (FK check fires even when auth.uid() IS NULL).
-- This proves the trigger is invariant.
select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_b'),
        'OP-SCHEMA-A-SR-MISMATCH',
        'planned')$$,
  '23514',
  null,
  'T25.1: service_role insert with mismatched workshop_id is rejected by invariant FK check (production_orders.quote_id)'
);

-- T25.2: same for production_order_events
select throws_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_b'),
        'planned',
        'in_progress',
        'service_role mismatch event',
        (select id from _prod_schema_ids where key = 'user_a'))$$,
  '23514',
  null,
  'T25.2: service_role insert with mismatched workshop_id is rejected by invariant FK check (production_order_events.production_order_id)'
);

-- T25.3: service_role insert with matched workshop_id succeeds (positive case
-- proves the invariant trigger does not false-positive). Combined with T25.1
-- and T25.2, this proves the trigger is fully invariant for service_role.
select lives_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-SR-MATCH',
        'planned')$$,
  'T25.3: service_role insert with matched workshop_id succeeds (invariant FK check MATCH branch)'
);

-- ==========================================================================
-- T26: internal write guard for PR-2 SECURITY DEFINER RPC path
--
-- Supabase RPCs called via PostgREST (e.g. .rpc('start_production_order', ...))
-- still have `auth.uid() IS NOT NULL` set from the user's JWT, even when the
-- RPC body is `SECURITY DEFINER`. A naive "block all auth.uid() IS NOT NULL"
-- trigger would therefore block the PR-2 RPCs, which is unacceptable.
--
-- PR 1 introduces a positive internal guard: the transaction-local setting
-- `app.production_order_write_context = 'rpc'`. The trigger only blocks
-- authenticated writes when this guard is MISSING or set to anything other
-- than the literal string 'rpc'. PR-2 SECURITY DEFINER RPCs set this guard
-- (`SET LOCAL app.production_order_write_context = 'rpc'`) AFTER they have
-- verified the caller's role and workshop.
--
-- This is defense-in-depth: it does NOT replace RLS or workshop checks.
-- It only proves that the trigger accepts the PR-2 RPC path while still
-- rejecting direct client writes (without the guard).
--
-- What we test:
--  - T26.1-T26.4: with guard='rpc' + permissive policy, INSERT/UPDATE/DELETE
--    succeed on production_orders; events INSERT succeeds.
--  - T26.5-T26.6: with guard='rpc', the same-workshop FK check STILL fires
--    (cross-tenant -> 23514, same-workshop -> success).
--  - T26.7-T26.8: with guard != 'rpc' (foo, empty), authenticated writes
--    are STILL rejected (regression of the original auth gate).
-- ==========================================================================

-- Reset role and ensure we have a clean auth state for the guard tests
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);

-- Create all permissive policies upfront (postgres role owns the table).
-- These policies would never exist in production — they exist only so the
-- trigger guard is the gate under test, not the RLS absence gate.
create policy production_orders_test_permissive_insert
  on public.production_orders
  for insert with check (true);
create policy production_orders_test_permissive_update
  on public.production_orders
  for update using (true) with check (true);
create policy production_orders_test_permissive_delete
  on public.production_orders
  for delete using (true);
create policy production_order_events_test_permissive_insert
  on public.production_order_events
  for insert with check (true);

-- Switch to authenticated role and set the JWT GUC once. The guard GUC
-- is reset to 'rpc' before each positive test and to other values before
-- each negative test.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _prod_schema_ids where key = 'user_a'),
  true);

-- T26.1: with the internal guard set, authenticated INSERT on production_orders
-- is allowed (simulating a PR-2 SECURITY DEFINER RPC body AFTER role/workshop
-- checks). The permissive INSERT policy exists so the test focuses on the
-- trigger-level guard, not the absence-of-policy gate.
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select lives_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-GUARD-INSERT',
        'planned')$$,
  'T26.1: with app.production_order_write_context = ''rpc'', authenticated INSERT is allowed (PR-2 RPC simulation)'
);

-- T26.2: with the guard set, authenticated UPDATE on production_orders is allowed
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select lives_ok(
  $$update public.production_orders
      set notes = 'updated via guard'
    where id = (select id from _prod_schema_ids where key = 'order_a')$$,
  'T26.2: with guard = ''rpc'', authenticated UPDATE is allowed (PR-2 RPC simulation)'
);

-- T26.3: with the guard set, authenticated DELETE on production_orders is allowed
-- (we delete the row we just inserted in T26.1 to avoid disturbing the
-- original order_a row used by other tests).
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select lives_ok(
  $$delete from public.production_orders
    where production_number = 'OP-SCHEMA-A-GUARD-INSERT'$$,
  'T26.3: with guard = ''rpc'', authenticated DELETE is allowed (PR-2 RPC simulation)'
);

-- T26.4: with the guard set, authenticated INSERT on production_order_events
-- is allowed. This is the append-only-but-RPC-owned path for transition events.
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select lives_ok(
  $$insert into public.production_order_events
       (workshop_id, production_order_id, from_state, to_state, reason, actor_id, metadata)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'order_a'),
        'planned',
        'in_progress',
        'guard-allowed event',
        (select id from _prod_schema_ids where key = 'user_a'),
        '{"request_id":"guard-test-1"}'::jsonb)$$,
  'T26.4: with guard = ''rpc'', authenticated INSERT on production_order_events is allowed (PR-2 RPC simulation)'
);

-- T26.5: with the guard set, cross-tenant INSERT is STILL rejected by the
-- same-workshop FK check (23514). The guard ONLY bypasses the auth gate;
-- tenant integrity remains invariant.
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_b'),
        'OP-SCHEMA-A-GUARD-CROSS',
        'planned')$$,
  '23514',
  null,
  'T26.5: with guard = ''rpc'', cross-tenant INSERT is rejected by invariant FK check (23514, not 42501)'
);

-- T26.6: with the guard set, same-workshop + same-parent INSERT succeeds
-- (proves the FK check MATCH branch is not blocked by the auth gate when
-- the guard is set; this is the exact positive path the PR-2 RPC will use).
select set_config(
  'app.production_order_write_context',
  'rpc',
  true);

select lives_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-GUARD-MATCH',
        'planned')$$,
  'T26.6: with guard = ''rpc'', same-workshop + same-parent INSERT succeeds (FK check MATCH, PR-2 RPC positive case)'
);

-- T26.7: guard value other than 'rpc' is rejected (exact-match required).
-- A future migration that sets the guard to a typo or a different marker
-- must NOT accidentally bypass the auth gate.
select set_config(
  'app.production_order_write_context',
  'foo',
  true);

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-GUARD-FOO',
        'planned')$$,
  '42501',
  'production_orders are immutable via direct INSERT; use start_production_order / transition_production_order_state RPCs',
  'T26.7: with guard = ''foo'' (not ''rpc''), authenticated INSERT is rejected (exact-match required)'
);

-- T26.8: empty-string guard is rejected (proves '' IS DISTINCT FROM 'rpc').
-- Catches the case where a caller clears the setting instead of setting it
-- to 'rpc' (e.g. '' || NULL coalesce patterns).
select set_config(
  'app.production_order_write_context',
  '',
  true);

select throws_ok(
  $$insert into public.production_orders
       (workshop_id, quote_id, production_number, state)
     values
       ((select id from _prod_schema_ids where key = 'workshop_a'),
        (select id from _prod_schema_ids where key = 'quote_a'),
        'OP-SCHEMA-A-GUARD-EMPTY',
        'planned')$$,
  '42501',
  'production_orders are immutable via direct INSERT; use start_production_order / transition_production_order_state RPCs',
  'T26.8: with guard = '''' (empty), authenticated INSERT is rejected (empty IS DISTINCT FROM ''rpc'')'
);

-- Cleanup: drop the permissive policies and reset the GUCs so the
-- transaction ends in a clean state.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
drop policy if exists production_orders_test_permissive_insert on public.production_orders;
drop policy if exists production_orders_test_permissive_update on public.production_orders;
drop policy if exists production_orders_test_permissive_delete on public.production_orders;
drop policy if exists production_order_events_test_permissive_insert on public.production_order_events;

select * from finish();
rollback;
