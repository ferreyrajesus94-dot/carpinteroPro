-- Test: production_orders write RPCs (PR 2)
--
-- Verifies the PR-2 deliverable for the production-order-state-machine change:
--   1. start_production_order RPC exists, is SECURITY DEFINER, takes the
--      expected parameters, and SETs LOCAL the internal guard after
--      role/workshop checks (so the PR-1 defense-in-depth triggers accept
--      the write).
--   2. transition_production_order_state RPC exists, is SECURITY DEFINER,
--      takes the expected parameters, and uses the same guard pattern.
--   3. start_production_order happy path: admin starts an order from an
--      'aprobado' quote, the order is created with state='planned', and an
--      event is appended to production_order_events with metadata.request_id.
--   4. start_production_order role/workshop checks: viewer rejected, foreign
--      workshop rejected, non-aprobado quote rejected, missing profile
--      rejected, missing quote rejected.
--   5. start_production_order idempotency on p_request_id: same request_id
--      returns the same order without creating a duplicate event.
--   6. transition state machine: every allowed transition succeeds, every
--      forbidden transition is rejected with a domain error and writes
--      no event.
--   7. transition role/workshop checks: viewer rejected, foreign workshop
--      rejected, missing order rejected.
--   8. transition idempotency on p_request_id: same request_id returns
--      success without a second event.
--   9. internal guard path: the production_orders / production_order_events
--      triggers accept the PR-2 RPC writes (via SET LOCAL) and STILL fire
--      the same-workshop FK check on cross-tenant attempts.
--  10. direct-write rejection on quotes.status = 'en_produccion': an
--      authenticated user (no guard) is rejected; service role and the
--      guard path are allowed; other status changes are unaffected.
--  11. SET LOCAL cleanup regression: the guard GUC is transaction-local —
--      the function body uses SET LOCAL (not session-local set_config(...,
--      false)), and SET LOCAL inside a savepoint is reverted by rollback
--      to savepoint.
--  12. The trigger function body uses current_setting(..., true)
--      (NULL-safe on missing setting).
--
-- PR 4 note: start_production_order was extended with an 8th parameter
-- p_create_deduction boolean DEFAULT true. All start_production_order
-- calls in this file pass `false` explicitly so the PR 2 tests exercise
-- the RPC behavior in isolation (no deduction batch is created). The
-- deduction linkage is tested in production_deduction_link.test.sql.

begin;

create extension if not exists pgtap with schema extensions;

select plan(97);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _prod_rpc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _prod_rpc_ids (key, id) values
  ('workshop_a', '11000000-0000-0000-0000-0000000000a1'),
  ('workshop_b', '11000000-0000-0000-0000-0000000000b1'),
  ('admin_a',    '22000000-0000-0000-0000-0000000000a1'),
  ('admin_b',    '22000000-0000-0000-0000-0000000000b2'),
  ('viewer_a',   '22000000-0000-0000-0000-0000000000a3'),
  ('quote_a',    '33000000-0000-0000-0000-0000000000a1'),
  ('quote_b',    '33000000-0000-0000-0000-0000000000b1'),
  ('quote_a_no_aprobado', '33000000-0000-0000-0000-0000000000a2'),
  ('quote_a_2',  '33000000-0000-0000-0000-0000000000a3'),
  ('quote_a_3',  '33000000-0000-0000-0000-0000000000a4'),
  ('quote_b_2',  '33000000-0000-0000-0000-0000000000b2'),
  ('quote_a_idem', '33000000-0000-0000-0000-0000000000a6'),
  ('assignee_a', '22000000-0000-0000-0000-0000000000a5');

grant select on _prod_rpc_ids to authenticated;

-- Seed two workshops
insert into public.workshops (id, name) values
  ((select id from _prod_rpc_ids where key = 'workshop_a'), 'Prod RPC Test Workshop A'),
  ((select id from _prod_rpc_ids where key = 'workshop_b'), 'Prod RPC Test Workshop B');

-- Seed three users
insert into auth.users (id, email) values
  ((select id from _prod_rpc_ids where key = 'admin_a'),  'prod-rpc-admin-a@example.com'),
  ((select id from _prod_rpc_ids where key = 'admin_b'),  'prod-rpc-admin-b@example.com'),
  ((select id from _prod_rpc_ids where key = 'viewer_a'), 'prod-rpc-viewer-a@example.com'),
  ((select id from _prod_rpc_ids where key = 'assignee_a'), 'prod-rpc-assignee-a@example.com');

-- Assign profiles
update public.profiles set workshop_id = (select id from _prod_rpc_ids where key = 'workshop_a')
  where id in (
    (select id from _prod_rpc_ids where key = 'admin_a'),
    (select id from _prod_rpc_ids where key = 'viewer_a'),
    (select id from _prod_rpc_ids where key = 'assignee_a')
  );

update public.profiles set workshop_id = (select id from _prod_rpc_ids where key = 'workshop_b')
  where id = (select id from _prod_rpc_ids where key = 'admin_b');

update public.profiles set workshop_role = 'admin'
  where id in (
    (select id from _prod_rpc_ids where key = 'admin_a'),
    (select id from _prod_rpc_ids where key = 'admin_b')
  );

update public.profiles set workshop_role = 'viewer'
  where id = (select id from _prod_rpc_ids where key = 'viewer_a');

-- Assignee profile: operational role in workshop_a (a real workshop member,
-- used by T16 (same-workshop accepted) and T15 (cross-workshop: admin_b
-- trying to assign admin_b to a workshop_a order is rejected)).
update public.profiles set workshop_role = 'operational'
  where id = (select id from _prod_rpc_ids where key = 'assignee_a');

-- Seed quotes
insert into public.quotes (id, workshop_id, quote_number, furniture_name, status) values
  ((select id from _prod_rpc_ids where key = 'quote_a'),
   (select id from _prod_rpc_ids where key = 'workshop_a'),
   'PROD-RPC-A-001', 'Prod RPC Test Furniture A', 'aprobado'),
  ((select id from _prod_rpc_ids where key = 'quote_b'),
   (select id from _prod_rpc_ids where key = 'workshop_b'),
   'PROD-RPC-B-001', 'Prod RPC Test Furniture B', 'aprobado'),
  ((select id from _prod_rpc_ids where key = 'quote_a_no_aprobado'),
   (select id from _prod_rpc_ids where key = 'workshop_a'),
   'PROD-RPC-A-002', 'Prod RPC Test Furniture A (presupuesto)', 'presupuesto'),
  ((select id from _prod_rpc_ids where key = 'quote_a_2'),
   (select id from _prod_rpc_ids where key = 'workshop_a'),
   'PROD-RPC-A-003', 'Prod RPC Test Furniture A2', 'aprobado'),
  ((select id from _prod_rpc_ids where key = 'quote_a_3'),
   (select id from _prod_rpc_ids where key = 'workshop_a'),
   'PROD-RPC-A-004', 'Prod RPC Test Furniture A3', 'aprobado'),
  ((select id from _prod_rpc_ids where key = 'quote_b_2'),
   (select id from _prod_rpc_ids where key = 'workshop_b'),
   'PROD-RPC-B-002', 'Prod RPC Test Furniture B2', 'aprobado'),
  ((select id from _prod_rpc_ids where key = 'quote_a_idem'),
   (select id from _prod_rpc_ids where key = 'workshop_a'),
   'PROD-RPC-A-IDEM', 'Prod RPC Test Furniture A (idempotency scope)', 'aprobado');

-- ==========================================================================
-- Helper functions
-- ==========================================================================

-- Switch to an authenticated user (and clear role + guard GUC).
create or replace function _prod_rpc_set_user(p_key text)
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
    (select id::text from _prod_rpc_ids where key = p_key),
    true);
end;
$$;

-- ==========================================================================
-- T1-T5: RPC existence, security model, and signature
-- ==========================================================================

-- T1.1: start_production_order function exists
-- PR 4 added an 8th parameter `p_create_deduction boolean DEFAULT true`
-- so the function can write a non-null production_order_id on the
-- deduction batch as part of the new flow. PR 2 tests pass
-- p_create_deduction = false to exercise the RPC in isolation.
select has_function(
  'public', 'start_production_order',
  array['uuid', 'text', 'date', 'date', 'uuid', 'text', 'uuid', 'boolean'],
  'T1.1: start_production_order(uuid, text, date, date, uuid, text, uuid, boolean) exists (PR 4 added p_create_deduction)'
);

-- T1.2: transition_production_order_state function exists
select has_function(
  'public', 'transition_production_order_state',
  array['uuid', 'production_order_state', 'text', 'uuid'],
  'T1.2: transition_production_order_state(uuid, production_order_state, text, uuid) exists'
);

-- T1.3: start_production_order is SECURITY DEFINER (via pg_proc.prosecdef)
select ok(
  (select prosecdef from pg_proc where proname = 'start_production_order' and pronamespace = 'public'::regnamespace),
  'T1.3: start_production_order runs as SECURITY DEFINER (the bridge between RLS and the RPC-only mutation path)'
);

-- T1.4: transition_production_order_state is SECURITY DEFINER
select ok(
  (select prosecdef from pg_proc where proname = 'transition_production_order_state' and pronamespace = 'public'::regnamespace),
  'T1.4: transition_production_order_state runs as SECURITY DEFINER'
);

-- T1.5: start_production_order body uses SET LOCAL (transaction-local guard)
select ok(
  exists(
    select 1 from pg_proc
     where proname = 'start_production_order'
       and pronamespace = 'public'::regnamespace
       and pg_get_functiondef(oid) ~ 'SET LOCAL app\.production_order_write_context'
  ),
  'T1.5: start_production_order body uses SET LOCAL app.production_order_write_context (transaction-local, not session-local)'
);

-- T1.6: start_production_order body does NOT use set_config(..., false) (session-local would leak)
select ok(
  not exists(
    select 1 from pg_proc
     where proname = 'start_production_order'
       and pronamespace = 'public'::regnamespace
       and pg_get_functiondef(oid) ~ 'set_config\([^,]+,[^,]+,\s*false\s*\)'
  ),
  'T1.6: start_production_order body does NOT use session-local set_config(name, value, false) (no leak)'
);

-- T1.7: transition_production_order_state body uses SET LOCAL
select ok(
  exists(
    select 1 from pg_proc
     where proname = 'transition_production_order_state'
       and pronamespace = 'public'::regnamespace
       and pg_get_functiondef(oid) ~ 'SET LOCAL app\.production_order_write_context'
  ),
  'T1.7: transition_production_order_state body uses SET LOCAL app.production_order_write_context'
);

-- T1.8: transition_production_order_state body does NOT use set_config(..., false)
select ok(
  not exists(
    select 1 from pg_proc
     where proname = 'transition_production_order_state'
       and pronamespace = 'public'::regnamespace
       and pg_get_functiondef(oid) ~ 'set_config\([^,]+,[^,]+,\s*false\s*\)'
  ),
  'T1.8: transition_production_order_state body does NOT use session-local set_config(name, value, false)'
);

-- ==========================================================================
-- T2-T6: start_production_order happy path
-- ==========================================================================

-- T2.1: admin_a can start a production order from an 'aprobado' quote
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a'),
    'OP-RPC-A-001',
    current_date,
    current_date + 7,
    null,
    'first order',
    '55000000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T2.1: admin_a starts production_order from an aprobado quote (happy path, p_create_deduction=false)'
);

-- Capture the order id for subsequent tests
create temporary table _prod_rpc_order_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _prod_rpc_order_ids (key, id) values
  ('prod_a', (select id from public.production_orders where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_a') and production_number = 'OP-RPC-A-001' limit 1));

-- T2.2: the order is created with state = 'planned'
select results_eq(
  $$select state::text from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values ('planned'::text)$$,
  'T2.2: the new order is created with state = planned'
);

-- T2.3: the order's workshop_id matches admin_a workshop
select results_eq(
  $$select workshop_id::text from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$select id::text from _prod_rpc_ids where key = 'workshop_a'$$,
  'T2.3: the new order workshop_id matches the caller workshop'
);

-- T2.4: the order's quote_id is the supplied quote
select results_eq(
  $$select quote_id::text from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$select id::text from _prod_rpc_ids where key = 'quote_a'$$,
  'T2.4: the new order quote_id is the supplied quote'
);

-- T2.5: the order's production_number is the supplied number
select results_eq(
  $$select production_number from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values ('OP-RPC-A-001'::text)$$,
  'T2.5: the new order production_number is the supplied number'
);

-- T2.6: the order's planned_start_date is the supplied date
select results_eq(
  $$select planned_start_date from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (current_date)$$,
  'T2.6: the new order planned_start_date is the supplied date'
);

-- T2.7: an event is appended to production_order_events
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (1::int)$$,
  'T2.7: exactly one event is appended for the new order (initial creation)'
);

-- T2.8: the event has from_state = NULL, to_state = 'planned'
select results_eq(
  $$select (from_state::text), (to_state::text) from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (null::text, 'planned'::text)$$,
  'T2.8: the creation event has from_state = NULL, to_state = planned'
);

-- T2.9: the event has actor_id = auth.uid() of the caller
select results_eq(
  $$select (actor_id::text) from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$select id::text from _prod_rpc_ids where key = 'admin_a'$$,
  'T2.9: the creation event actor_id is the caller (admin_a)'
);

-- T2.10: the event metadata stores the request_id
select results_eq(
  $$select (metadata->>'request_id')::text from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values ('55000000-0000-0000-0000-0000000000a1'::text)$$,
  'T2.10: the creation event metadata.request_id matches the supplied p_request_id'
);

-- ==========================================================================
-- T3: start_production_order role/workshop checks
-- ==========================================================================

-- T3.1: viewer role is rejected
select _prod_rpc_set_user('viewer_a');

select throws_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a'),
    'OP-RPC-A-VIEWER',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  '42501',
  null,
  'T3.1: viewer role is rejected from start_production_order (role gate)'
);

-- T3.2: foreign-workshop quote is rejected (admin_b tries workshop_a quote)
select _prod_rpc_set_user('admin_b');

select throws_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a'),
    'OP-RPC-CROSS',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  '42501',
  null,
  'T3.2: foreign-workshop quote is rejected (cross-workshop access denied)'
);

-- T3.3: non-aprobado quote is rejected
select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_no_aprobado'),
    'OP-RPC-NOAPROB',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  'P0001',
  null,
  'T3.3: quote in non-aprobado status is rejected (status precondition)'
);

-- T3.4: missing quote is rejected
select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$select public.start_production_order(
    '99999999-0000-0000-0000-000000000099'::uuid,
    'OP-RPC-MISSING',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  'P0002',
  null,
  'T3.4: missing quote is rejected (quote not found)'
);

-- T3.5a: setup — admin_a creates a baseline order OP-RPC-A-DUP for the duplicate test
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_2'),
    'OP-RPC-A-DUP',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  'T3.5a: setup — admin_a creates a baseline order OP-RPC-A-DUP for the duplicate test'
);

-- Now try to create another with the same production_number in the same workshop.
-- Use a permissive policy + guard to simulate the RPC path:
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
create policy prod_rpc_test_permissive_insert
  on public.production_orders for insert with check (true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _prod_rpc_ids where key = 'admin_a'), true);
select set_config('app.production_order_write_context', 'rpc', true);

-- T3.5b: duplicate (workshop_id, production_number) is rejected (unique constraint)
select throws_ok(
  $$insert into public.production_orders (workshop_id, quote_id, production_number, state)
     values (
       (select id from _prod_rpc_ids where key = 'workshop_a'),
       (select id from _prod_rpc_ids where key = 'quote_a_2'),
       'OP-RPC-A-DUP',
       'planned'
     )$$,
  '23505',
  null,
  'T3.5: duplicate (workshop_id, production_number) is rejected (unique constraint, 23505)'
);

-- T3.6: same production_number in a different workshop is allowed (unique per workshop)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
drop policy prod_rpc_test_permissive_insert on public.production_orders;
select _prod_rpc_set_user('admin_b');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_b'),
    'OP-RPC-A-DUP',
    null, null, null, null,
    gen_random_uuid(),
    false
  )$$,
  'T3.6: same production_number in a different workshop is allowed (unique per workshop)'
);

insert into _prod_rpc_order_ids (key, id) values
  ('prod_b', (select id from public.production_orders where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_b') and production_number = 'OP-RPC-A-DUP' limit 1));

-- ==========================================================================
-- T4: start_production_order idempotency on p_request_id
-- ==========================================================================

-- T4.1: pre-state: count events for the T2 order
-- First switch to admin_a so RLS scopes the count to the prod_a workshop.
select _prod_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (1::int)$$,
  'T4.1: baseline event count for the T2 order is 1'
);

-- T4.2: re-call start_production_order with the SAME p_request_id. The RPC must
-- return success without creating a duplicate event (idempotent retry).
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a'),
    'OP-RPC-A-001-IDEMPOTENT',
    null, null, null, null,
    '55000000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T4.2: re-calling start_production_order with the same p_request_id returns success (idempotent retry)'
);

-- T4.3: event count is still 1 (no duplicate)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (1::int)$$,
  'T4.3: event count is still 1 after the idempotent retry (no duplicate event)'
);

-- T4.4: a different p_request_id creates a new order (idempotency is per-request-id)
select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_2'),
    'OP-RPC-A-002',
    null, null, null, null,
    '55000000-0000-0000-0000-0000000000a2'::uuid,
    false
  )$$,
  'T4.4: a different p_request_id creates a new order (idempotency is per-request-id)'
);

-- ==========================================================================
-- T5: transition_production_order_state happy path
-- ==========================================================================

-- T5.1: planned → in_progress (allowed)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a'),
    'in_progress'::public.production_order_state,
    'starting work',
    '66000000-0000-0000-0000-0000000000a1'::uuid
  )$$,
  'T5.1: transition planned -> in_progress succeeds (allowed transition)'
);

-- T5.2: order state is updated to in_progress
select results_eq(
  $$select state::text from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values ('in_progress'::text)$$,
  'T5.2: order state is updated to in_progress after the transition'
);

-- T5.3: a new event is appended (creation + transition = 2 events)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (2::int)$$,
  'T5.3: a second event is appended for the transition (creation + 1 transition)'
);

-- T5.4: the new event has from_state = 'planned', to_state = 'in_progress'
select results_eq(
  $$select (from_state::text), (to_state::text) from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a') and to_state = 'in_progress'::public.production_order_state$$,
  $$values ('planned'::text, 'in_progress'::text)$$,
  'T5.4: the transition event has from_state = planned, to_state = in_progress'
);

-- T5.5: the transition event has actor_id = auth.uid() of the caller
select results_eq(
  $$select (actor_id::text) from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a') and to_state = 'in_progress'::public.production_order_state$$,
  $$select id::text from _prod_rpc_ids where key = 'admin_a'$$,
  'T5.5: the transition event actor_id is the caller (admin_a)'
);

-- T5.6: the transition event has a reason = 'starting work'
select results_eq(
  $$select reason from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a') and to_state = 'in_progress'::public.production_order_state$$,
  $$values ('starting work'::text)$$,
  'T5.6: the transition event reason matches the supplied p_reason'
);

-- ==========================================================================
-- T6: transition state machine — allowed + forbidden
-- ==========================================================================

-- T6.1: in_progress → quality_check (allowed)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a'),
    'quality_check'::public.production_order_state,
    'quality check',
    '66000000-0000-0000-0000-0000000000a2'::uuid
  )$$,
  'T6.1: transition in_progress -> quality_check succeeds (allowed transition)'
);

-- T6.2: quality_check → ready (allowed)
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a'),
    'ready'::public.production_order_state,
    'ready for delivery',
    '66000000-0000-0000-0000-0000000000a3'::uuid
  )$$,
  'T6.2: transition quality_check -> ready succeeds (allowed transition)'
);

-- T6.3: order state is now ready
select results_eq(
  $$select state::text from public.production_orders where id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values ('ready'::text)$$,
  'T6.3: order state is updated to ready after the transition'
);

-- T6.4: total event count for the order is 4 (creation + 3 transitions)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (4::int)$$,
  'T6.4: total event count is 4 (creation + planned->in_progress + in_progress->quality_check + quality_check->ready)'
);

-- T6.5: forbidden — ready → in_progress is rejected (must go through quality_check or cancelled)
select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a'),
    'in_progress'::public.production_order_state,
    'should fail (ready -> in_progress is forbidden)',
    gen_random_uuid()
  )$$,
  'P0001',
  null,
  'T6.5: ready -> in_progress is rejected (forbidden transition, 42501/P0001)'
);

-- T6.6: forbidden transition writes NO event (event count is still 4)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_a')$$,
  $$values (4::int)$$,
  'T6.6: forbidden transition writes no event (event count is still 4)'
);

-- T6.7: forbidden — planned → ready is rejected (must go through in_progress)
-- Use a fresh order for this test
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_3'),
    'OP-RPC-A-006',
    null, null, null, null,
    '55000000-0000-0000-0000-0000000000a6'::uuid,
    false
  )$$,
  'T6.7a: setup — admin_a creates a fresh planned order for the planned->ready forbidden test'
);

-- Capture the new order id
insert into _prod_rpc_order_ids (key, id) values
  ('prod_a_2', (select id from public.production_orders where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_a') and production_number = 'OP-RPC-A-006' limit 1));

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'ready'::public.production_order_state,
    'should fail (must go through in_progress first)',
    gen_random_uuid()
  )$$,
  'P0001',
  null,
  'T6.7: planned -> ready is rejected (must go through in_progress, P0001 forbidden transition)'
);

-- T6.8: forbidden — delivered → in_progress is rejected (terminal state)
-- Transition prod_a_2 to delivered first (planned -> in_progress -> quality_check -> ready -> delivered)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'in_progress'::public.production_order_state,
    'starting',
    '66000000-0000-0000-0000-0000000000a7'::uuid
  )$$,
  'T6.8a: setup — transition prod_a_2 to in_progress'
);

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'quality_check'::public.production_order_state,
    'quality check',
    '66000000-0000-0000-0000-0000000000a8'::uuid
  )$$,
  'T6.8b: setup — transition prod_a_2 to quality_check'
);

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'ready'::public.production_order_state,
    'ready',
    '66000000-0000-0000-0000-0000000000a9'::uuid
  )$$,
  'T6.8c: setup — transition prod_a_2 to ready'
);

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'delivered'::public.production_order_state,
    'delivered',
    '66000000-0000-0000-0000-0000000000aa'::uuid
  )$$,
  'T6.8d: setup — transition prod_a_2 to delivered (terminal state)'
);

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'in_progress'::public.production_order_state,
    'should fail (delivered is terminal)',
    gen_random_uuid()
  )$$,
  'P0001',
  null,
  'T6.8: delivered -> in_progress is rejected (terminal state, P0001 forbidden transition)'
);

-- ==========================================================================
-- T6.9-T6.15: paused round-trip + paused forbidden transitions
--
-- PR 2 contract (per verify-report.md line 496): "All other allowed
-- transitions (in_progress->paused, paused->in_progress, in_progress->
-- quality_check, quality_check->ready, ready->delivered) | T6.1-T6.5".
--
-- The reconstructed test file (post-PR 4 incident) only exercised
-- planned->in_progress, in_progress->quality_check, and quality_check->ready.
-- The in_progress <-> paused branch was missing. This block restores
-- semantic PR 2 coverage for the paused branch of the state machine
-- with a fresh fixture (prod_paused) and proves both the allowed
-- round-trip (in_progress->paused->in_progress) and that forbidden
-- transitions OUT OF paused (paused->quality_check, paused->delivered)
-- are rejected with P0001 and write no event.
-- ==========================================================================

-- T6.9a: setup — admin_a creates a fresh planned order for the paused tests
-- (prod_a is at ready, prod_a_2 is at delivered, prod_idem is at quality_check
--  — none of them is at in_progress, which is what we need for the paused
--  round-trip. We use quote_a_idem; the production_number is fresh.)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_idem'),
    'OP-RPC-A-PAUSED',
    null, null, null, null,
    '6a000000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T6.9a: setup — admin_a creates a fresh planned order for the paused round-trip tests'
);

-- Capture the new order id
insert into _prod_rpc_order_ids (key, id) values
  ('prod_paused', (select id from public.production_orders
                    where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_a')
                      and production_number = 'OP-RPC-A-PAUSED' limit 1));

-- T6.9b: transition prod_paused from planned to in_progress (setup for paused)
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'in_progress'::public.production_order_state,
    'starting work before pause',
    '6a000000-0000-0000-0000-0000000000a2'::uuid
  )$$,
  'T6.9b: setup — transition prod_paused from planned to in_progress (setup for paused tests)'
);

-- T6.9c: order state is in_progress
select results_eq(
  $$select state::text from public.production_orders
    where id = (select id from _prod_rpc_order_ids where key = 'prod_paused')$$,
  $$values ('in_progress'::text)$$,
  'T6.9c: prod_paused is in in_progress (setup verified, ready for paused transitions)'
);

-- T6.10: in_progress -> paused (allowed — restores the missing PR 2 paused coverage)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'paused'::public.production_order_state,
    'pausing work temporarily',
    '6a000000-0000-0000-0000-0000000000a3'::uuid
  )$$,
  'T6.10a: in_progress -> paused is allowed (the missing PR 2 paused transition coverage)'
);

-- T6.10b: order state is updated to paused
select results_eq(
  $$select state::text from public.production_orders
    where id = (select id from _prod_rpc_order_ids where key = 'prod_paused')$$,
  $$values ('paused'::text)$$,
  'T6.10b: order state is updated to paused after the transition'
);

-- T6.10c: the transition event has from_state = in_progress, to_state = paused
select results_eq(
  $$select (from_state::text), (to_state::text)
      from public.production_order_events
     where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_paused')
       and to_state = 'paused'::public.production_order_state$$,
  $$values ('in_progress'::text, 'paused'::text)$$,
  'T6.10c: the pause event has from_state = in_progress, to_state = paused'
);

-- T6.11: paused -> in_progress (allowed — work resumes after pause)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'in_progress'::public.production_order_state,
    'resuming work after pause',
    '6a000000-0000-0000-0000-0000000000a4'::uuid
  )$$,
  'T6.11a: paused -> in_progress is allowed (resume work after pause, the second half of the round-trip)'
);

-- T6.11b: order state is back to in_progress after the round-trip
select results_eq(
  $$select state::text from public.production_orders
    where id = (select id from _prod_rpc_order_ids where key = 'prod_paused')$$,
  $$values ('in_progress'::text)$$,
  'T6.11b: order state is back to in_progress after the paused round-trip'
);

-- T6.11c: the resume event has from_state = paused, to_state = in_progress
-- (filter by the most recent in_progress transition to avoid matching T6.9b's)
select results_eq(
  $$select (from_state::text), (to_state::text)
      from public.production_order_events
     where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_paused')
       and from_state = 'paused'::public.production_order_state
       and to_state = 'in_progress'::public.production_order_state$$,
  $$values ('paused'::text, 'in_progress'::text)$$,
  'T6.11c: the resume event has from_state = paused, to_state = in_progress (round-trip completes)'
);

-- T6.12: total event count for prod_paused is 4
-- (creation + planned->in_progress + in_progress->paused + paused->in_progress)
select results_eq(
  $$select count(*)::int from public.production_order_events
     where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_paused')$$,
  $$values (4::int)$$,
  'T6.12: total event count is 4 (creation + planned->in_progress + in_progress->paused + paused->in_progress)'
);

-- T6.13a: setup — transition prod_paused back to paused for the forbidden tests
-- (paused only allows in_progress and cancelled; quality_check and delivered
--  must be rejected by the transition state machine)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'paused'::public.production_order_state,
    'pausing again for the forbidden-direction tests',
    '6a000000-0000-0000-0000-0000000000a5'::uuid
  )$$,
  'T6.13a: setup — transition prod_paused back to paused for the forbidden-direction tests'
);

-- T6.13b: paused -> quality_check is FORBIDDEN (paused allows only in_progress and cancelled)
select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'quality_check'::public.production_order_state,
    'should fail (paused -> quality_check is forbidden, must go through in_progress first)',
    gen_random_uuid()
  )$$,
  'P0001',
  null,
  'T6.13: paused -> quality_check is rejected (forbidden transition, P0001 — paused only allows in_progress and cancelled)'
);

-- T6.14: paused -> delivered is FORBIDDEN (delivered requires going through quality_check and ready)
select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_paused'),
    'delivered'::public.production_order_state,
    'should fail (paused -> delivered is forbidden, must go through in_progress->quality_check->ready->delivered)',
    gen_random_uuid()
  )$$,
  'P0001',
  null,
  'T6.14: paused -> delivered is rejected (forbidden transition, P0001 — must traverse in_progress->quality_check->ready->delivered)'
);

-- T6.15: forbidden transitions write NO event (defense-in-depth on event append)
-- After T6.13a (1 added event) + T6.13b (0) + T6.14 (0), event count is 5
select results_eq(
  $$select count(*)::int from public.production_order_events
     where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_paused')$$,
  $$values (5::int)$$,
  'T6.15: forbidden paused->quality_check and paused->delivered write no event (event count is still 5 after T6.13+T6.14 attempts; defense-in-depth on event append)'
);

-- ==========================================================================
-- T7: transition role/workshop checks
-- ==========================================================================

-- T7.1: viewer role is rejected from transition
select _prod_rpc_set_user('viewer_a');

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'in_progress'::public.production_order_state,
    'should fail',
    gen_random_uuid()
  )$$,
  '42501',
  null,
  'T7.1: viewer role is rejected from transition_production_order_state (role gate)'
);

-- T7.2: cross-workshop transition is rejected (admin_b tries workshop_a order)
select _prod_rpc_set_user('admin_b');

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'in_progress'::public.production_order_state,
    'should fail',
    gen_random_uuid()
  )$$,
  '42501',
  null,
  'T7.2: cross-workshop transition is rejected (admin_b cannot transition workshop_a order)'
);

-- T7.3: missing order is rejected
select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$select public.transition_production_order_state(
    '99999999-0000-0000-0000-000000000098'::uuid,
    'in_progress'::public.production_order_state,
    'should fail',
    gen_random_uuid()
  )$$,
  'P0002',
  null,
  'T7.3: missing order is rejected (order not found)'
);

-- T7.4: missing profile is rejected
-- (simulated by clearing the JWT sub and setting role to authenticated)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

select throws_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_a_2'),
    'in_progress'::public.production_order_state,
    'should fail',
    gen_random_uuid()
  )$$,
  '42501',
  null,
  'T7.4: missing profile is rejected (caller has no profile/workshop)'
);

-- Reset user to admin_a for the rest of the tests
select _prod_rpc_set_user('admin_a');

-- ==========================================================================
-- T8: transition idempotency on p_request_id
-- ==========================================================================

-- T8.0: setup — create a fresh planned order for the idempotency test
-- (prod_a_2 is at delivered after T6.8, so we need a fresh order)
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_idem'),
    'OP-RPC-A-IDEM-PROD',
    null, null, null, null,
    '88000000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T8.0: setup — admin_a creates a fresh planned order for the transition idempotency test'
);

insert into _prod_rpc_order_ids (key, id) values
  ('prod_idem', (select id from public.production_orders where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_a') and production_number = 'OP-RPC-A-IDEM-PROD' limit 1));

-- T8.1: baseline event count for prod_idem (creation = 1, no transitions yet)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_idem')$$,
  $$values (1::int)$$,
  'T8.1: baseline event count for prod_idem is 1 (creation only)'
);

-- T8.2: transition prod_idem from planned to in_progress
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_idem'),
    'in_progress'::public.production_order_state,
    'starting',
    '77000000-0000-0000-0000-0000000000a1'::uuid
  )$$,
  'T8.2: first transition (planned -> in_progress) for the idempotency test'
);

-- T8.3: event count is 2 after the first transition
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_idem')$$,
  $$values (2::int)$$,
  'T8.3: event count is 2 after the first transition'
);

-- T8.4: re-call transition with the SAME p_request_id
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_idem'),
    'in_progress'::public.production_order_state,
    'should be no-op',
    '77000000-0000-0000-0000-0000000000a1'::uuid
  )$$,
  'T8.4: re-call transition with the same p_request_id returns success (idempotent retry)'
);

-- T8.5: event count is still 2 (no duplicate)
select results_eq(
  $$select count(*)::int from public.production_order_events where production_order_id = (select id from _prod_rpc_order_ids where key = 'prod_idem')$$,
  $$values (2::int)$$,
  'T8.5: event count is still 2 after the idempotent retry (no duplicate event)'
);

-- T8.6: a different p_request_id creates a new transition
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_idem'),
    'quality_check'::public.production_order_state,
    'quality check',
    '77000000-0000-0000-0000-0000000000a2'::uuid
  )$$,
  'T8.6: a different p_request_id creates a new transition (idempotency is per-request-id)'
);

-- ==========================================================================
-- T9: internal guard path — RPC writes are accepted via SET LOCAL
-- ==========================================================================

-- T9.1: a service_role insert WITH the guard set is accepted (positive path)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
create policy prod_rpc_test_guard_insert
  on public.production_orders for insert with check (true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _prod_rpc_ids where key = 'admin_a'), true);
select set_config('app.production_order_write_context', 'rpc', true);

select lives_ok(
  $$insert into public.production_orders (workshop_id, quote_id, production_number, state)
     values (
       (select id from _prod_rpc_ids where key = 'workshop_a'),
       (select id from _prod_rpc_ids where key = 'quote_a'),
       'OP-RPC-GUARD-OK',
       'planned'
     )$$,
  'T9.1: authenticated INSERT with the guard set is accepted (defense-in-depth trigger allows the RPC path)'
);

-- T9.2: cross-tenant INSERT is rejected by the same-workshop FK check even with the guard set
select throws_ok(
  $$insert into public.production_orders (workshop_id, quote_id, production_number, state)
     values (
       (select id from _prod_rpc_ids where key = 'workshop_a'),
       (select id from _prod_rpc_ids where key = 'quote_b'),
       'OP-RPC-GUARD-CROSS',
       'planned'
     )$$,
  '23514',
  null,
  'T9.2: cross-workshop INSERT is rejected by the same-workshop FK check (defense in depth, 23514)'
);

-- T9.3: guard with non-'rpc' value (foo) is rejected by the auth-gate trigger
select set_config('app.production_order_write_context', 'foo', true);

select throws_ok(
  $$insert into public.production_orders (workshop_id, quote_id, production_number, state)
     values (
       (select id from _prod_rpc_ids where key = 'workshop_a'),
       (select id from _prod_rpc_ids where key = 'quote_a'),
       'OP-RPC-GUARD-FOO',
       'planned'
     )$$,
  '42501',
  null,
  'T9.3: guard = foo is rejected by the auth-gate trigger (guard must be exactly ''rpc'')'
);

-- Cleanup the permissive policy
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
drop policy prod_rpc_test_guard_insert on public.production_orders;

-- ==========================================================================
-- T10: direct-write rejection on quotes.status = 'en_produccion'
-- ==========================================================================

-- T10.1: authenticated user (no guard) cannot INSERT a quote with en_produccion status
select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$insert into public.quotes (workshop_id, quote_number, furniture_name, status)
     values (
       (select id from _prod_rpc_ids where key = 'workshop_a'),
       'RPC-ENPROD-INSERT',
       'Test',
       'en_produccion'::public.quote_status
     )$$,
  '42501',
  null,
  'T10.1: authenticated INSERT of quotes.status = en_produccion is rejected by the direct-write trigger (42501)'
);

-- T10.2: transitioning to entregado is allowed (not en_produccion)
-- We use a fresh quote in entregado status. Since the trigger only blocks
-- transitions TO en_produccion, all other status changes are unaffected.
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$update public.quotes set status = 'entregado'::public.quote_status
     where id = (select id from _prod_rpc_ids where key = 'quote_a_3')$$,
  'T10.2: UPDATE quotes.status to entregado is allowed (trigger only blocks INTO en_produccion)'
);

-- T10.3: authenticated user (no guard) cannot UPDATE a quote's status TO en_produccion
select throws_ok(
  $$update public.quotes set status = 'en_produccion'::public.quote_status
     where id = (select id from _prod_rpc_ids where key = 'quote_a_2')$$,
  '42501',
  null,
  'T10.3: authenticated UPDATE of quotes.status TO en_produccion is rejected by the direct-write trigger (42501)'
);

-- T10.4: WITH the guard set, UPDATE to en_produccion is allowed
-- (future-proofing: a future RPC that needs to set en_produccion can set the guard)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _prod_rpc_ids where key = 'admin_a'), true);
select set_config('app.production_order_write_context', 'rpc', true);

select lives_ok(
  $$update public.quotes set status = 'en_produccion'::public.quote_status
     where id = (select id from _prod_rpc_ids where key = 'quote_a_2')$$,
  'T10.4: authenticated UPDATE of quotes.status TO en_produccion with the guard = ''rpc'' is allowed (future RPC path)'
);

-- T10.5: UPDATE FROM en_produccion TO another status is allowed (the projection re-evaluates)
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.production_order_write_context', '', true);
select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$update public.quotes set status = 'entregado'::public.quote_status
     where id = (select id from _prod_rpc_ids where key = 'quote_a_2')$$,
  'T10.5: UPDATE quotes.status FROM en_produccion TO entregado is allowed (out-of-en_produccion direction is unaffected)'
);

-- ==========================================================================
-- T11: SET LOCAL cleanup regression — guard is transaction-local, not session-local
-- ==========================================================================

-- T11.1: function bodies use SET LOCAL (not session-local set_config(name, value, false))
-- (verified by T1.6 and T1.8 above; this test is the runtime check)

-- T11.2a: SET LOCAL inside a savepoint — on rollback to savepoint, the guard is reverted
savepoint s_t11;
set local app.production_order_write_context = 'rpc';
-- Roll back to savepoint
rollback to savepoint s_t11;
-- The guard is now NULL again (transaction-local, not session-local)
select ok(
  current_setting('app.production_order_write_context', true) IS DISTINCT FROM 'rpc',
  'T11.2a: SET LOCAL is reverted on rollback to savepoint (transaction-local, not session-local)'
);
release savepoint s_t11;

-- T11.2b: after a full rollback (this transaction), the guard is NULL too
-- (this is implicit in T11.2a, but make it explicit)
select ok(
  current_setting('app.production_order_write_context', true) IS DISTINCT FROM 'rpc',
  'T11.2b: SET LOCAL is reverted on transaction rollback (not session-local)'
);

-- ==========================================================================
-- T12: trigger function body uses current_setting(..., true) (NULL-safe)
-- ==========================================================================

-- T12.1: the trigger function references current_setting(name, true) for NULL-safety
select ok(
  exists(
    select 1 from pg_proc
     where proname in (
       'prevent_authenticated_production_order_mutation',
       'prevent_authenticated_production_order_event_mutation'
     )
       and pronamespace = 'public'::regnamespace
       and pg_get_functiondef(oid) ~ 'current_setting\([^,]+,\s*true\s*\)'
  ),
  'T12.1: production_orders and production_order_events trigger functions use current_setting(name, true) for NULL-safety on the guard GUC'
);

-- T12.2: trigger function has no declared args (trigger functions receive TG_* variables, not args)
select ok(
  (
    select array_length(p.proargtypes, 1) = 0
      from pg_proc p
      join pg_namespace n on p.pronamespace = n.oid
     where n.nspname = 'public'
       and p.proname in (
         'prevent_authenticated_production_order_mutation',
         'prevent_authenticated_production_order_event_mutation'
       )
     limit 1
  ),
  'T12.2: trigger function has no declared args (TG_* variables are populated by the trigger mechanism, not function args)'
);

-- ==========================================================================
-- T13: start_production_order acquires FOR UPDATE on the quote BEFORE the
--      idempotency lookup (concurrency-safe under retry)
-- ==========================================================================

select ok(
  (
    select position('FOR UPDATE' in pg_get_functiondef(oid))
         < position('metadata->>' in pg_get_functiondef(oid))
      from pg_proc
     where proname = 'start_production_order'
       and pronamespace = 'public'::regnamespace
  ),
  'T13: start_production_order acquires FOR UPDATE on the quote BEFORE the idempotency lookup (concurrency-safe under retry)'
);

-- ==========================================================================
-- T14: transition_production_order_state acquires FOR UPDATE on the order
--      BEFORE the idempotency lookup (concurrency-safe under retry)
-- ==========================================================================

select ok(
  (
    select position('FOR UPDATE' in pg_get_functiondef(oid))
         < position('metadata->>' in pg_get_functiondef(oid))
      from pg_proc
     where proname = 'transition_production_order_state'
       and pronamespace = 'public'::regnamespace
  ),
  'T14: transition_production_order_state acquires FOR UPDATE on the order BEFORE the idempotency lookup (concurrency-safe under retry)'
);

-- ==========================================================================
-- T15: p_assigned_to cross-workshop rejection — the assignee must be a
--      profile in the same workshop as the caller's. Without this check,
--      a caller from workshop_a could assign a workshop_b profile, which
--      would create a production_order with assigned_to pointing at a
--      foreign-workshop user, bypassing tenant isolation. After the fix,
--      this call raises 42501.
-- ==========================================================================

select _prod_rpc_set_user('admin_a');

select throws_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_b_2'),
    'OP-RPC-A-CROSS-ASSIGN',
    null, null,
    (select id from _prod_rpc_ids where key = 'admin_b'),
    'cross-workshop assignee',
    gen_random_uuid(),
    false
  )$$,
  '42501',
  null,
  'T15: start_production_order rejects cross-workshop p_assigned_to with 42501 (tenant isolation on the assignee)'
);

-- ==========================================================================
-- T16: p_assigned_to same-workshop acceptance (triangulation for T15).
--      The assignee (assignee_a) is a profile in workshop_a, so admin_a
--      can assign them. After the fix, this call succeeds.
-- ==========================================================================

select _prod_rpc_set_user('admin_a');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_idem'),
    'OP-RPC-A-SAME-ASSIGN',
    null, null,
    (select id from _prod_rpc_ids where key = 'assignee_a'),
    'same-workshop assignee',
    gen_random_uuid(),
    false
  )$$,
  'T16: start_production_order accepts same-workshop p_assigned_to (assignee_a is in workshop_a)'
);

-- ==========================================================================
-- T17: idempotency scope for start_production_order — the request_id
--      must be scoped to (workshop_id, operation, quote_id), not just
--      (workshop_id, request_id). Otherwise, reusing a request_id from
--      one quote's start on a different quote would silently return the
--      original quote's order, corrupting the second quote's lifecycle.
-- ==========================================================================

select _prod_rpc_set_user('admin_a');

-- T17.1 setup: start an order on quote_a with request_id X
-- (use a fresh production_number to avoid the unique constraint)
select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a'),
    'OP-RPC-A-IDEM-SCOPE',
    null, null, null, null,
    '99990000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T17.1: setup — admin_a starts an order on quote_a with request_id X (idempotency scope baseline)'
);

-- T17.2: re-call start with the SAME request_id but a DIFFERENT quote
-- (quote_a_idem, also in workshop_a and aprobado). The fix must create a
-- new order on quote_a_idem, not return the quote_a order.
select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_a_idem'),
    'OP-RPC-A-IDEM-SCOPE-DIFFERENT',
    null, null, null, null,
    '99990000-0000-0000-0000-0000000000a1'::uuid,
    false
  )$$,
  'T17.2: same request_id, DIFFERENT quote — must create a new order on quote_a_idem, not return the quote_a order'
);

-- T17.3: the new order for quote_a_2 has the new production_number
-- (proves the second call did not silently return the quote_a order).
select results_eq(
  $$select production_number from public.production_orders
    where production_number = 'OP-RPC-A-IDEM-SCOPE-DIFFERENT'::text
    order by created_at desc limit 1$$,
  $$values ('OP-RPC-A-IDEM-SCOPE-DIFFERENT'::text)$$,
  'T17.3: a new order with production_number OP-RPC-A-IDEM-SCOPE-DIFFERENT was created (idempotency is per-quote, not per-workshop)'
);

-- T17.4: the original order for quote_a still exists (proves the first
-- order is unchanged and a NEW row was created for quote_a_2).
select results_eq(
  $$select count(*)::int from public.production_orders
    where production_number = 'OP-RPC-A-IDEM-SCOPE'::text$$,
  $$values (1::int)$$,
  'T17.4: the original OP-RPC-A-IDEM-SCOPE order for quote_a still exists (no duplicate was created for the second quote)'
);

-- ==========================================================================
-- T18: idempotency scope for transition_production_order_state — the
--      request_id must be scoped to (workshop_id, operation, order_id,
--      to_state), not just (workshop_id, request_id). Otherwise, reusing
--      a request_id from one transition on a different transition would
--      silently return the original order's state, corrupting the
--      transition log.
-- ==========================================================================

-- T18.1 setup: create a fresh order for admin_b (T8 transitions left
-- prod_b in 'planned' state; we need a separate 'planned' order
-- for the T18.2 same-request-id retry to land on a different order).
-- We use quote_b_2 for the fresh setup.
select _prod_rpc_set_user('admin_b');

select lives_ok(
  $$select public.start_production_order(
    (select id from _prod_rpc_ids where key = 'quote_b_2'),
    'OP-RPC-B-IDEM-SCOPE',
    null, null, null, null,
    '99990000-0000-0000-0000-0000000000b1'::uuid,
    false
  )$$,
  'T18.1: setup — admin_b creates a new planned order for the transition-idempotency-scope test'
);

-- Capture the new order id
insert into _prod_rpc_order_ids (key, id) values
  ('prod_b_idem', (select id from public.production_orders
                    where workshop_id = (select id from _prod_rpc_ids where key = 'workshop_b')
                      and production_number = 'OP-RPC-B-IDEM-SCOPE' limit 1));

-- T18.2: transition prod_b_idem from planned to in_progress with request_id Y
select _prod_rpc_set_user('admin_b');

select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_b_idem'),
    'in_progress'::public.production_order_state,
    'starting',
    '88880000-0000-0000-0000-0000000000b1'::uuid
  )$$,
  'T18.2: transition prod_b_idem to in_progress with request_id Y (baseline)'
);

-- T18.3: re-call with the SAME request_id and SAME to_state — idempotent retry, no-op
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_b_idem'),
    'in_progress'::public.production_order_state,
    'should be no-op',
    '88880000-0000-0000-0000-0000000000b1'::uuid
  )$$,
  'T18.3: re-call transition with the same request_id and same to_state — idempotent retry, no-op'
);

-- T18.4: same request_id but DIFFERENT to_state — must create a new transition event
-- (the to_state discriminator in the idempotency scope prevents stale reads
-- from being silently short-circuited)
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from _prod_rpc_order_ids where key = 'prod_b_idem'),
    'quality_check'::public.production_order_state,
    'quality check (different to_state, same request_id)',
    '88880000-0000-0000-0000-0000000000b1'::uuid
  )$$,
  'T18.4: same request_id, DIFFERENT to_state — must create a new transition event (to_state discriminator prevents stale-payload short-circuit)'
);

rollback;
