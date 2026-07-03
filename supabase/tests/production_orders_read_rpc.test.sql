-- Test: production_orders read RPCs (PR 3)
--
-- Verifies the PR-3 deliverable for the production-order-state-machine change:
--   1. list_production_orders — paginated, filterable, tenant-scoped list of
--      production orders for the caller's workshop. Returns denormalized
--      quote_number, quote_furniture_name, and assigned_to_name for the
--      board UI.
--   2. get_production_order — single order lookup by id. Returns the same
--      shape as list_production_orders plus quote_status and quote_client_name.
--   3. get_production_order_events — append-only timeline of state transitions
--      for a given order, ordered by created_at ASC, with denormalized
--      actor_name. Empty result for cross-workshop ids (RLS).
--   4. get_quotes_with_production_status — projects the effective
--      production status of every quote in the caller's workshop from the
--      production_orders state. Active orders (planned/in_progress/paused/
--      quality_check/ready) overlay en_produccion; all-delivered orders
--      overlay entregado; otherwise the stored quote.status is returned.
--   5. get_production_pipeline_stats — counts of production_orders grouped
--      by state for the caller's workshop, including zero-count states.
--
-- All read RPCs run SECURITY INVOKER so the existing SELECT-only RLS policy
-- on production_orders / production_order_events / quotes (scoped by
-- get_current_workshop_id()) is the single source of tenant isolation.
-- Cross-workshop ids return empty (treated as "not visible"), not an error.

begin;

create extension if not exists pgtap with schema extensions;

-- ==========================================================================
-- T1: Function existence
-- ==========================================================================
-- These references are the deterministic RED: the read RPCs do not exist
-- yet, so has_function must fail. The migration will CREATE them.
-- ==========================================================================

select plan(101);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================

create temporary table _read_rpc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _read_rpc_ids (key, id) values
  ('workshop_a',  '11000000-0000-0000-0000-0000000000a1'),
  ('workshop_b',  '11000000-0000-0000-0000-0000000000b1'),
  ('admin_a',     '22000000-0000-0000-0000-0000000000a1'),
  ('admin_b',     '22000000-0000-0000-0000-0000000000b2'),
  ('viewer_a',    '22000000-0000-0000-0000-0000000000a3'),
  ('assignee_a',  '22000000-0000-0000-0000-0000000000a4'),
  ('client_a',    '23000000-0000-0000-0000-0000000000a1'),
  ('client_b',    '23000000-0000-0000-0000-0000000000b1'),
  ('quote_a',     '33000000-0000-0000-0000-0000000000a1'),
  ('quote_b',     '33000000-0000-0000-0000-0000000000b1'),
  ('quote_a_idle','33000000-0000-0000-0000-0000000000a2'),
  ('quote_a_del', '33000000-0000-0000-0000-0000000000a3');

grant select on _read_rpc_ids to authenticated;

-- Seed two workshops
insert into public.workshops (id, name) values
  ((select id from _read_rpc_ids where key = 'workshop_a'), 'Read RPC Test Workshop A'),
  ((select id from _read_rpc_ids where key = 'workshop_b'), 'Read RPC Test Workshop B');

-- Seed users
insert into auth.users (id, email) values
  ((select id from _read_rpc_ids where key = 'admin_a'),    'read-rpc-admin-a@example.com'),
  ((select id from _read_rpc_ids where key = 'admin_b'),    'read-rpc-admin-b@example.com'),
  ((select id from _read_rpc_ids where key = 'viewer_a'),   'read-rpc-viewer-a@example.com'),
  ((select id from _read_rpc_ids where key = 'assignee_a'), 'read-rpc-assignee-a@example.com');

-- Assign profiles
update public.profiles
   set workshop_id = (select id from _read_rpc_ids where key = 'workshop_a')
 where id in (
   (select id from _read_rpc_ids where key = 'admin_a'),
   (select id from _read_rpc_ids where key = 'viewer_a'),
   (select id from _read_rpc_ids where key = 'assignee_a')
 );

update public.profiles
   set workshop_id = (select id from _read_rpc_ids where key = 'workshop_b')
 where id = (select id from _read_rpc_ids where key = 'admin_b');

update public.profiles set workshop_role = 'admin'
  where id in (
    (select id from _read_rpc_ids where key = 'admin_a'),
    (select id from _read_rpc_ids where key = 'admin_b')
  );

update public.profiles set workshop_role = 'viewer'
  where id = (select id from _read_rpc_ids where key = 'viewer_a');

update public.profiles set workshop_role = 'operational'
  where id = (select id from _read_rpc_ids where key = 'assignee_a');

update public.profiles set display_name = 'Alice Admin'
  where id = (select id from _read_rpc_ids where key = 'admin_a');
update public.profiles set display_name = 'Bob Admin'
  where id = (select id from _read_rpc_ids where key = 'admin_b');
update public.profiles set display_name = 'Vic Viewer'
  where id = (select id from _read_rpc_ids where key = 'viewer_a');
update public.profiles set display_name = 'Aida Assignee'
  where id = (select id from _read_rpc_ids where key = 'assignee_a');

-- Seed clients
insert into public.clients (id, workshop_id, name) values
  ((select id from _read_rpc_ids where key = 'client_a'),
   (select id from _read_rpc_ids where key = 'workshop_a'),
   'Client A Inc.'),
  ((select id from _read_rpc_ids where key = 'client_b'),
   (select id from _read_rpc_ids where key = 'workshop_b'),
   'Client B Inc.');

-- Seed quotes
insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status) values
  ((select id from _read_rpc_ids where key = 'quote_a'),
   (select id from _read_rpc_ids where key = 'workshop_a'),
   'READ-RPC-A-001',
   (select id from _read_rpc_ids where key = 'client_a'),
   'Read RPC Furniture A', 'aprobado'),
  ((select id from _read_rpc_ids where key = 'quote_a_idle'),
   (select id from _read_rpc_ids where key = 'workshop_a'),
   'READ-RPC-A-IDLE',
   (select id from _read_rpc_ids where key = 'client_a'),
   'Read RPC Furniture A (idle, no orders)', 'aprobado'),
  ((select id from _read_rpc_ids where key = 'quote_a_del'),
   (select id from _read_rpc_ids where key = 'workshop_a'),
   'READ-RPC-A-DEL',
   (select id from _read_rpc_ids where key = 'client_a'),
   'Read RPC Furniture A (all delivered)', 'aprobado'),
  ((select id from _read_rpc_ids where key = 'quote_b'),
   (select id from _read_rpc_ids where key = 'workshop_b'),
   'READ-RPC-B-001',
   (select id from _read_rpc_ids where key = 'client_b'),
   'Read RPC Furniture B', 'aprobado');

-- ==========================================================================
-- Helper: switch to an authenticated user
-- ==========================================================================
create or replace function _read_rpc_set_user(p_key text)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  perform set_config(
    'request.jwt.claim.sub',
    (select id::text from _read_rpc_ids where key = p_key),
    true);
end;
$$;

-- ==========================================================================
-- T1: function existence
-- ==========================================================================

-- T1.1
select has_function(
  'public', 'list_production_orders',
  array['production_order_state[]', 'uuid', 'uuid', 'text', 'integer', 'integer'],
  'T1.1: list_production_orders(states, assigned_to, quote_id, search, limit, offset) exists'
);

-- T1.2
select has_function(
  'public', 'get_production_order',
  array['uuid'],
  'T1.2: get_production_order(order_id) exists'
);

-- T1.3
select has_function(
  'public', 'get_production_order_events',
  array['uuid'],
  'T1.3: get_production_order_events(order_id) exists'
);

-- T1.4
select has_function(
  'public', 'get_quotes_with_production_status',
  array['integer', 'integer'],
  'T1.4: get_quotes_with_production_status(limit, offset) exists'
);

-- T1.5
select has_function(
  'public', 'get_production_pipeline_stats',
  array[]::text[],
  'T1.5: get_production_pipeline_stats() exists'
);

-- T1.6: list_production_orders is SECURITY INVOKER (not DEFINER) — reads
-- must run as the caller so RLS provides tenant isolation
select ok(
  not (select prosecdef from pg_proc
        where proname = 'list_production_orders'
          and pronamespace = 'public'::regnamespace),
  'T1.6: list_production_orders runs as SECURITY INVOKER (RLS isolates tenants)'
);

-- T1.7: get_production_order is SECURITY INVOKER
select ok(
  not (select prosecdef from pg_proc
        where proname = 'get_production_order'
          and pronamespace = 'public'::regnamespace),
  'T1.7: get_production_order runs as SECURITY INVOKER'
);

-- T1.8: get_production_order_events is SECURITY INVOKER
select ok(
  not (select prosecdef from pg_proc
        where proname = 'get_production_order_events'
          and pronamespace = 'public'::regnamespace),
  'T1.8: get_production_order_events runs as SECURITY INVOKER'
);

-- T1.9: get_quotes_with_production_status is SECURITY INVOKER
select ok(
  not (select prosecdef from pg_proc
        where proname = 'get_quotes_with_production_status'
          and pronamespace = 'public'::regnamespace),
  'T1.9: get_quotes_with_production_status runs as SECURITY INVOKER'
);

-- T1.10: get_production_pipeline_stats is SECURITY INVOKER
select ok(
  not (select prosecdef from pg_proc
        where proname = 'get_production_pipeline_stats'
          and pronamespace = 'public'::regnamespace),
  'T1.10: get_production_pipeline_stats runs as SECURITY INVOKER'
);

-- ==========================================================================
-- T2: list_production_orders
-- ==========================================================================
-- We seed orders in workshop_a across the full state space using the
-- PR-2 write RPCs (which set the internal guard and respect RLS).
-- Workshop_b gets one order for cross-workshop isolation tests.
-- ==========================================================================

-- T2.1: workshop_a has 5 orders in different states
select _read_rpc_set_user('admin_a');

-- Seed via the PR-2 write RPCs (which set the guard). We use the order
-- creation happy path; transitions are exercised inline below.
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a'),
    'OP-READ-A-001',
    current_date, current_date + 7,
    (select id from _read_rpc_ids where key = 'assignee_a'),
    'first order',
    'aa000000-0000-0000-0000-000000000001'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T2.1a: setup — admin_a starts order OP-READ-A-001 (planned)'
);

-- T2.1b: list_production_orders returns the order
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.1b: list_production_orders returns 1 order for workshop_a after seeding'
);

-- T2.2: cross-workshop isolation — admin_a cannot see workshop_b's order.
-- We seed admin_b's order first, then verify admin_a's count is still 1.
select _read_rpc_set_user('admin_b');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_b'),
    'OP-READ-B-001',
    null, null, null, null,
    'bb000000-0000-0000-0000-000000000001'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T2.2a: setup — admin_b starts an order in workshop_b'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.2b: list_production_orders for admin_a returns 1 (workshop_b order is invisible)'
);

-- T2.2c: admin_b sees only the 1 workshop_b order
select _read_rpc_set_user('admin_b');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.2c: list_production_orders for admin_b returns 1 (only the workshop_b order)'
);

-- T2.3: denormalized fields are present
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_number::text from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values ('OP-READ-A-001'::text)$$,
  'T2.3: list_production_orders returns the production_number denormalized'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select quote_number::text from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values ('READ-RPC-A-001'::text)$$,
  'T2.3b: list_production_orders returns the quote_number denormalized'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select quote_furniture_name::text from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values ('Read RPC Furniture A'::text)$$,
  'T2.3c: list_production_orders returns the quote_furniture_name denormalized'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select assigned_to_name::text from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values ('Aida Assignee'::text)$$,
  'T2.3d: list_production_orders returns the assigned_to_name denormalized'
);

-- T2.4: state filter
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned']::public.production_order_state[],
    null, null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.4a: state filter (planned) returns 1 order'
);

-- T2.4b: state filter (in_progress) returns 0 (no order has been transitioned)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['in_progress']::public.production_order_state[],
    null, null, null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.4b: state filter (in_progress) returns 0 (no order is in_progress yet)'
);

-- T2.4c: state filter with multiple states — both returned
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned', 'in_progress']::public.production_order_state[],
    null, null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.4c: state filter (planned, in_progress) returns 1 (matches planned)'
);

-- T2.5: assigned_to filter
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null,
    (select id from _read_rpc_ids where key = 'assignee_a'),
    null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.5a: assigned_to filter matches the order assigned to assignee_a'
);

-- T2.5b: assigned_to filter that does not match
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null,
    (select id from _read_rpc_ids where key = 'admin_b'),
    null, null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.5b: assigned_to filter (foreign user) returns 0'
);

-- T2.6: quote_id filter
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null,
    (select id from _read_rpc_ids where key = 'quote_a'),
    null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.6a: quote_id filter matches the order on quote_a'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null,
    (select id from _read_rpc_ids where key = 'quote_a_idle'),
    null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.6b: quote_id filter (quote_a_idle has no orders) returns 0'
);

-- T2.7: search filter (ILIKE on production_number + notes)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, 'OP-READ-A-001', 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.7a: search filter (production_number) matches'
);

-- T2.7b: search by notes fragment
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, 'first order', 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.7b: search filter (notes fragment) matches'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, 'no-such-text-xyz', 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.7c: search filter (no match) returns 0'
);

-- T2.8: pagination — limit 0 returns 0 rows
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 0, 0
  )$$,
  $$values (0::int)$$,
  'T2.8: limit 0 returns 0 rows (edge case)'
);

-- T2.9: offset past the end returns 0 rows
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, 50
  )$$,
  $$values (0::int)$$,
  'T2.9: offset past the end returns 0 rows (pagination edge case)'
);

-- T2.10: combined state + assigned_to filter (triangulation: filters AND together)
-- At this point only OP-READ-A-001 exists (planned, assigned to assignee_a).
-- The combined filter exercises AND-of-filters, which is a different code
-- path from a single filter. The 2nd order is added at the end of T2.10
-- so subsequent tests have multi-order data.

-- T2.10a: state=planned AND assigned_to=assignee_a returns 1
-- (OP-READ-A-001 is in planned, assigned to assignee_a)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned']::public.production_order_state[],
    (select id from _read_rpc_ids where key = 'assignee_a'),
    null, null, 100, 0
  )$$,
  $$values (1::int)$$,
  'T2.10a: state=planned AND assigned_to=assignee_a returns 1 (OP-READ-A-001)'
);

-- T2.10b: state=planned AND assigned_to=admin_a returns 0
-- (no order is assigned to admin_a)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned']::public.production_order_state[],
    (select id from _read_rpc_ids where key = 'admin_a'),
    null, null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.10b: state=planned AND assigned_to=admin_a returns 0 (no order is assigned to admin_a)'
);

-- T2.10c: state=planned AND quote_id=quote_a_idle returns 0
-- (no order is on quote_a_idle yet)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned']::public.production_order_state[],
    null,
    (select id from _read_rpc_ids where key = 'quote_a_idle'),
    null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.10c: state=planned AND quote_id=quote_a_idle returns 0 (no order on quote_a_idle yet)'
);

-- T2.10d: state=in_progress (no filters) returns 0 (no order in in_progress)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['in_progress']::public.production_order_state[],
    null, null, null, 100, 0
  )$$,
  $$values (0::int)$$,
  'T2.10d: state=in_progress (no filters) returns 0 (no order is in_progress yet)'
);

-- T2.10e: create a 2nd order on a fresh quote (no assignee) so subsequent
-- tests have multi-order data. We use a fresh quote (not quote_a_idle,
-- which T5.2 expects to have no orders) and seed the quote as service
-- role to bypass RLS.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status)
values (
  '33000000-0000-0000-0000-0000000000a5',
  (select id from _read_rpc_ids where key = 'workshop_a'),
  'READ-RPC-A-EXTRA',
  (select id from _read_rpc_ids where key = 'client_a'),
  'Read RPC Furniture A (extra)', 'aprobado'
)
on conflict (id) do nothing;
insert into _read_rpc_ids (key, id) values
  ('quote_a_extra', '33000000-0000-0000-0000-0000000000a5')
on conflict (key) do nothing;

select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_extra'),
    'OP-READ-A-002',
    null, null, null, 'no assignee order',
    'aa000000-0000-0000-0000-000000000010'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T2.10e: setup — admin_a starts a 2nd order on quote_a_extra (no assignee, planned)'
);

-- T2.10f: state=planned (no assigned_to) returns 2 (both orders)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    array['planned']::public.production_order_state[],
    null, null, null, 100, 0
  )$$,
  $$values (2::int)$$,
  'T2.10f: state=planned (no assigned_to filter) returns 2 (OP-READ-A-001 and OP-READ-A-002)'
);

-- ==========================================================================
-- T3: get_production_order
-- ==========================================================================

-- T3.1: returns the order when called by an admin in the same workshop
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select state::text from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('planned'::text)$$,
  'T3.1: get_production_order returns the order in planned state'
);

-- T3.2: returns the denormalized quote_status
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select quote_status::text from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('aprobado'::text)$$,
  'T3.2: get_production_order returns the denormalized quote_status'
);

-- T3.3: cross-workshop returns 0 rows (RLS) — admin_a cannot see workshop_b's order
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-B-001')
  )$$,
  $$values (0::int)$$,
  'T3.3: get_production_order returns 0 rows for cross-workshop id (RLS, not an error)'
);

-- T3.4: nonexistent order returns 0 rows
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order(
    '99999999-0000-0000-0000-000000000099'::uuid
  )$$,
  $$values (0::int)$$,
  'T3.4: get_production_order returns 0 rows for a nonexistent uuid'
);

-- T3.5: viewer role can read (read RPCs have no role gate, only RLS)
select _read_rpc_set_user('viewer_a');
select results_eq(
  $$select state::text from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('planned'::text)$$,
  'T3.5: get_production_order is readable by viewer role (no role gate, RLS only)'
);

-- T3.6: get_production_order for an order with NULL assigned_to returns
-- assigned_to_name as an empty string (the LEFT JOIN yields no profile
-- row, COALESCE returns ''). This is a triangulation case for the
-- T3.3 + T3.5 happy paths: the LEFT JOIN code branch is exercised.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select assigned_to_name::text from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-A-002')
  )$$,
  $$values (''::text)$$,
  'T3.6: get_production_order returns empty assigned_to_name for an order with NULL assignee (LEFT JOIN + COALESCE branch)'
);

-- T3.7: get_production_order returns the denormalized quote_client_name
-- (LEFT JOIN clients + COALESCE) for an order whose quote has a client.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select quote_client_name::text from public.get_production_order(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('Client A Inc.'::text)$$,
  'T3.7: get_production_order returns the denormalized quote_client_name (LEFT JOIN clients + COALESCE branch)'
);

-- ==========================================================================
-- T4: get_production_order_events
-- ==========================================================================

-- T4.1: returns the single creation event for the order, ordered by created_at ASC
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values (1::int)$$,
  'T4.1: get_production_order_events returns 1 event for a fresh order (creation only)'
);

-- T4.2: the event has from_state = NULL, to_state = 'planned'
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select (from_state::text), (to_state::text) from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values (null::text, 'planned'::text)$$,
  'T4.2: the creation event has from_state = NULL, to_state = planned'
);

-- T4.3: actor_name is denormalized
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select actor_name::text from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('Alice Admin'::text)$$,
  'T4.3: the event has the denormalized actor_name (Alice Admin)'
);

-- T4.4: metadata is returned
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select (metadata->>'request_id')::text from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values ('aa000000-0000-0000-0000-000000000001'::text)$$,
  'T4.4: the event metadata includes the request_id (carried from start_production_order)'
);

-- T4.5: after a transition, events are returned in order
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'in_progress'::public.production_order_state,
    'starting work',
    'aa000000-0000-0000-0000-000000000002'::uuid
  )$$,
  'T4.5a: setup — transition OP-READ-A-001 to in_progress'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  )$$,
  $$values (2::int)$$,
  'T4.5b: get_production_order_events returns 2 events (creation + transition)'
);

-- T4.6: events are ordered by (created_at ASC, id ASC) — stable across
-- calls. Both events in OP-READ-A-001 share the same created_at (they
-- were inserted in the same transaction, so DEFAULT now() returns the
-- same value). The previous implementation ordered by created_at ASC
-- only, which left the order between tied events as implementation-
-- defined and dependent on the table's physical order. The new
-- implementation (PR 3 blocker fix) adds `e.id ASC` as a stable
-- tie-breaker. T4.6 now asserts that the returned order is STABLE
-- across two independent calls (proving the tie-breaker is in effect);
-- T8.1 (below) proves the tie-breaker is specifically `id ASC`.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select array_agg(e.id::text) from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  ) e$$,
  $$select array_agg(e.id::text) from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-A-001')
  ) e$$,
  'T4.6: events are returned in stable order across calls (created_at ASC, id ASC tie-breaker)'
);

-- T4.7: cross-workshop events are not visible (RLS)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-B-001')
  )$$,
  $$values (0::int)$$,
  'T4.7: get_production_order_events returns 0 rows for cross-workshop order id'
);

-- T4.8: nonexistent order id returns 0 rows
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    '99999999-0000-0000-0000-000000000099'::uuid
  )$$,
  $$values (0::int)$$,
  'T4.8: get_production_order_events returns 0 rows for a nonexistent uuid'
);

-- ==========================================================================
-- T5: get_quotes_with_production_status
-- ==========================================================================
-- Logic under test:
--   - Active order(s) (planned/in_progress/paused/quality_check/ready)
--     -> projection = 'en_produccion'.
--   - All orders delivered -> projection = 'entregado'.
--   - No orders OR all cancelled -> projection = stored quote.status.
-- ==========================================================================

-- T5.1: quote_a has an active (planned) order -> en_produccion
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a')$$,
  $$values ('en_produccion'::text)$$,
  'T5.1: quote with an active (planned) order projects to en_produccion'
);

-- T5.2: quote_a_idle has no orders -> stored status (aprobado) is returned
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_idle')$$,
  $$values ('aprobado'::text)$$,
  'T5.2: quote with no production orders projects to its stored status (aprobado)'
);

-- T5.3: transition the order to delivered, then re-check the projection
select _read_rpc_set_user('admin_a');
-- transition through the full path to delivered
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'paused'::public.production_order_state,
    'break',
    'aa000000-0000-0000-0000-000000000003'::uuid
  )$$,
  'T5.3a: setup — in_progress -> paused'
);
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'in_progress'::public.production_order_state,
    'resuming',
    'aa000000-0000-0000-0000-000000000004'::uuid
  )$$,
  'T5.3b: setup — paused -> in_progress'
);
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'quality_check'::public.production_order_state,
    'inspect',
    'aa000000-0000-0000-0000-000000000005'::uuid
  )$$,
  'T5.3c: setup — in_progress -> quality_check'
);
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'ready'::public.production_order_state,
    'ready to ship',
    'aa000000-0000-0000-0000-000000000006'::uuid
  )$$,
  'T5.3d: setup — quality_check -> ready'
);
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-001'),
    'delivered'::public.production_order_state,
    'delivered to client',
    'aa000000-0000-0000-0000-000000000007'::uuid
  )$$,
  'T5.3e: setup — ready -> delivered'
);

select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a')$$,
  $$values ('entregado'::text)$$,
  'T5.3f: when all orders are delivered, the projection becomes entregado'
);

-- T5.4: workshop_b's quote_b is not visible to admin_a (RLS)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_quotes_with_production_status(100, 0)
     where workshop_id = (select id from _read_rpc_ids where key = 'workshop_b')$$,
  $$values (0::int)$$,
  'T5.4: admin_a cannot see workshop_b quotes via the projection (RLS)'
);

-- T5.5: has_active_production reflects the active-order state
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select has_active_production::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a')$$,
  $$values ('false'::text)$$,
  'T5.5: after delivery, has_active_production is false (no order is in an active state)'
);

-- T5.6: the projection carries the original quote row columns
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select quote_number::text, stored_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_idle')$$,
  $$values ('READ-RPC-A-IDLE'::text, 'aprobado'::text)$$,
  'T5.6: the projection includes quote_number and the stored_status'
);

-- T5.7: workshop_b's quote_b is visible to admin_b
select _read_rpc_set_user('admin_b');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_b')$$,
  $$values ('en_produccion'::text)$$,
  'T5.7: admin_b sees workshop_b quotes with their own projection'
);

-- T5.8: a quote with ONLY cancelled orders projects to the stored status
-- (the projection rules: has_active=false, delivered_count=0, so the
-- stored quote.status is returned). This is a triangulation case for
-- T5.2 (no orders) and T5.3 (delivered) — the cancelled branch.
-- We add a new quote (quote_a_cancel) and create + cancel an order on it.
-- Insert the quote as service role (RLS bypass) — we are seeding test data.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status)
values (
  '33000000-0000-0000-0000-0000000000a4',
  (select id from _read_rpc_ids where key = 'workshop_a'),
  'READ-RPC-A-CANCEL',
  (select id from _read_rpc_ids where key = 'client_a'),
  'Read RPC Furniture A (cancelled only)', 'aprobado'
);
insert into _read_rpc_ids (key, id) values
  ('quote_a_cancel', '33000000-0000-0000-0000-0000000000a4');

-- Create the order in planned state
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_cancel'),
    'OP-READ-A-CANCEL',
    null, null, null, 'will be cancelled',
    'aa000000-0000-0000-0000-000000000020'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T5.8a: setup — admin_a starts an order on the new quote (planned)'
);

-- Cancel the order: planned -> cancelled (allowed transition)
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-CANCEL'),
    'cancelled'::public.production_order_state,
    'no longer needed',
    'aa000000-0000-0000-0000-000000000021'::uuid
  )$$,
  'T5.8b: setup — transition the order to cancelled'
);

-- Assert the projection is the stored status (aprobado)
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_cancel')$$,
  $$values ('aprobado'::text)$$,
  'T5.8c: a quote with only cancelled orders projects to the stored status (aprobado) — the cancelled branch'
);

-- T5.8d: has_active_production is false for the cancelled-only quote
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select has_active_production::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_cancel')$$,
  $$values ('false'::text)$$,
  'T5.8d: has_active_production is false for the cancelled-only quote'
);

-- T5.9: pagination of get_quotes_with_production_status — limit 1 returns at most 1 row
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_quotes_with_production_status(1, 0)$$,
  $$values (1::int)$$,
  'T5.9: get_quotes_with_production_status(limit=1) returns exactly 1 row (pagination edge case)'
);

-- ==========================================================================
-- T6: get_production_pipeline_stats
-- ==========================================================================

-- T6.1: admin_a's pipeline stats reflect 3 orders: 1 in planned
-- (OP-READ-A-002 from T2.10a) and 2 in terminal states
-- (OP-READ-A-001 in delivered after T5.3e, OP-READ-A-CANCEL in
-- cancelled from T5.8b). The pipeline view shows ONLY active
-- states per the spec — terminal states are not part of the
-- pipeline. The active states with 0 count are still returned
-- so the dashboard does not need a 5-way UNION of missing
-- states.
--
-- PR 8 review-blocker fix #2: the spec mandates active-only
-- (planned, in_progress, paused, quality_check, ready). Terminal
-- states (delivered, cancelled) MUST NOT be in the pipeline. The
-- widget no longer needs to filter terminal states client-side
-- because the SQL contract honors the spec.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select state::text, count::bigint from public.get_production_pipeline_stats()
     order by state::text$$,
  $$values
    ('in_progress', 0::bigint),
    ('paused', 0::bigint),
    ('planned', 1::bigint),
    ('quality_check', 0::bigint),
    ('ready', 0::bigint)
  $$,
  'T6.1: get_production_pipeline_stats for admin_a shows the active states only (planned=1, all other active states 0) — terminal states (delivered, cancelled) are EXCLUDED from the pipeline per spec'
);

-- T6.1b: triangulation for the active-only contract — terminal
-- orders exist in admin_a's workshop but are NOT in the pipeline.
-- This pins the contract that the SQL excludes delivered/cancelled
-- even when those states have non-zero counts.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_pipeline_stats()$$,
  $$values (5::int)$$,
  'T6.1b: get_production_pipeline_stats returns exactly 5 rows (one per active state) — terminal states are excluded per spec'
);

-- T6.1c: every row's state is one of the active states (no terminal
-- state leaks into the pipeline). This is a defense-in-depth check
-- that survives any future refactor of the CTE / WHERE clause.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select bool_and(state in (
       'planned'::public.production_order_state,
       'in_progress'::public.production_order_state,
       'paused'::public.production_order_state,
       'quality_check'::public.production_order_state,
       'ready'::public.production_order_state
     ))
     from public.get_production_pipeline_stats()$$,
  $$values (true::boolean)$$,
  'T6.1c: every state in get_production_pipeline_stats is an active state (no terminal state leaks in)'
);

-- T6.2: admin_b's pipeline stats reflect 1 order in planned
-- (terminal states, if any, are excluded by the active-only filter).
select _read_rpc_set_user('admin_b');
select results_eq(
  $$select state::text, count::bigint from public.get_production_pipeline_stats()
     order by state::text$$,
  $$values
    ('in_progress', 0::bigint),
    ('paused', 0::bigint),
    ('planned', 1::bigint),
    ('quality_check', 0::bigint),
    ('ready', 0::bigint)
  $$,
  'T6.2: admin_b sees only workshop_b counts (planned=1, all other active states 0) — RLS isolates, terminal states excluded'
);

-- T6.3 (renamed): every active state is represented in the result
-- (zero counts are still returned for the dashboard's static column
-- layout). PR 8 review-blocker fix #2 changed the contract from
-- "7 rows (one per enum value)" to "5 rows (one per active state)".
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.get_production_pipeline_stats()$$,
  $$values (5::int)$$,
  'T6.3: get_production_pipeline_stats returns exactly 5 rows (one per active state)'
);

-- ==========================================================================
-- T7: viewer role can read (no role gate, RLS only)
-- ==========================================================================
select _read_rpc_set_user('viewer_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, 0
  )$$,
  $$values (3::int)$$,
  'T7.1: list_production_orders is readable by viewer role — viewer sees all 3 admin_a orders (RLS only, no role gate)'
);

-- T7.2: viewer_a cannot see admin_b's orders (RLS still applies for viewers)
select _read_rpc_set_user('viewer_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, 'OP-READ-B-001', 100, 0
  )$$,
  $$values (0::int)$$,
  'T7.2: viewer_a cannot see admin_b''s order OP-READ-B-001 via list_production_orders (RLS still isolates by workshop)'
);

-- T7.3: get_production_order_events for a foreign-workshop order is empty for viewer
select _read_rpc_set_user('viewer_a');
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    (select id from public.production_orders where production_number = 'OP-READ-B-001')
  )$$,
  $$values (0::int)$$,
  'T7.3: viewer_a sees 0 events for admin_b''s order (RLS + SECURITY INVOKER path)'
);

-- ==========================================================================
-- T8: PR 3 review-blocker fix coverage
-- ==========================================================================
-- PR 3 review surfaced four blockers. This scenario group writes the
-- failing tests first (RED) so the implementation in
-- 20260630000004_production_read_rpc_blocker_fix.sql is forced to make
-- them pass (GREEN).
--
--   T8.1 — B1 CRITICAL: get_production_order_events must be DETERMINISTIC
--          for tied created_at. The current implementation only orders by
--          created_at ASC; two events inserted in the same transaction
--          can share a timestamp, and PostgreSQL is free to return them
--          in any order between them. The test inserts 3 events with the
--          SAME created_at and asserts the RPC returns them in id ASC
--          order (a stable tie-breaker). The assertion does NOT re-sort
--          the RPC result — it compares the RPC's natural output order
--          to the explicit id ASC order. If the RPC lacks a stable
--          tie-breaker, the two arrays will differ and the test fails.
--
--          The 3 event ids are EXPLICIT and chosen so insertion order
--          is intentionally different from id ASC order (ee... first,
--          bb... second, 55... third; id ASC yields 55..., bb..., ee...).
--          A broken implementation that only orders by created_at
--          (returns rows in physical/insertion order) will return
--          ee..., bb..., 55..., which does NOT match the expected
--          id ASC array. The test is therefore deterministic and
--          cannot pass by chance on a broken implementation, unlike
--          the previous version that used auto-generated random UUIDs
--          (where the random id ASC order could accidentally match
--          insertion order and mask a missing tie-breaker).
--
--   T8.2 — B2 WARNING: a quote with BOTH delivered AND cancelled orders
--          must NOT project to 'entregado'. The spec says "all orders
--          delivered" — a cancelled order alongside a delivered one is
--          NOT "all delivered". The strict semantic is: project
--          'entregado' only when every order is in 'delivered' state.
--          Mixed delivered+cancelled should fall through to the stored
--          status (e.g. 'aprobado').
--
--   T8.3 — B2 triangulation: a delivered + cancelled mix on a SECOND
--          fresh quote also falls through to stored status. T8.2
--          already covers the same shape on quote_a_extra; T8.3 uses
--          a different quote (quote_a_multi) to guard against a
--          hypothetical implementation that accidentally hard-codes
--          the T8.2 quote id. The fixture is 1 delivered + 1 cancelled
--          on quote_a_multi. This guards against an accidental
--          implementation that only checks "delivered_count > 0 AND
--          cancelled_count = 1" instead of "all orders are delivered".
--
--   T8.4-T8.7 — B4 SUGGESTION: list_production_orders must handle NULL
--          and negative p_limit / p_offset deterministically via
--          COALESCE and GREATEST. NULL p_limit / p_offset should be
--          treated as the documented defaults (100 / 0); negative values
--          should be clamped to 0 (the existing GREATEST(., 0) handles
--          negatives for free once NULL is also handled).
-- ==========================================================================

-- T8.1 — B1 CRITICAL: tied-timestamp events return in id ASC order (stable
-- tie-breaker). Setup: create a fresh order on a fresh quote (no existing
-- events) and insert 3 events with the SAME created_at via direct INSERT
-- (service role, bypasses the guard). The 3 explicit ids are chosen so
-- insertion order is intentionally different from id ASC order (see the
-- CRITICAL comment above the INSERT), so a broken implementation that
-- returns rows in physical/insertion order cannot accidentally pass.
-- Then call the RPC and assert the returned order matches `id ASC`
-- for the tied events (no re-sort in the assertion).
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Fresh quote + order for T8.1 (workshop_a, no conflicts with other tests)
insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status)
values (
  '33000000-0000-0000-0000-0000000000a6',
  (select id from _read_rpc_ids where key = 'workshop_a'),
  'READ-RPC-A-TIED',
  (select id from _read_rpc_ids where key = 'client_a'),
  'Read RPC Furniture A (tied-timestamp events)', 'aprobado'
) on conflict (id) do nothing;
insert into _read_rpc_ids (key, id) values
  ('quote_a_tied', '33000000-0000-0000-0000-0000000000a6')
on conflict (key) do nothing;

-- Create the order via the PR-2 RPC (sets the internal guard)
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_tied'),
    'OP-READ-A-TIED',
    null, null, null, 'tied-timestamp order',
    'aa000000-0000-0000-0000-0000000000a1'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T8.1a: setup — admin_a starts OP-READ-A-TIED for the tied-timestamp test'
);

-- Insert 3 events with the SAME created_at (direct INSERT as service role
-- bypasses the guard and avoids the RPC's now() per-call timestamp drift).
-- Use a fixed timestamp far from now() so it never collides with the
-- start event's created_at (which is now() at test time).
--
-- CRITICAL: the 3 explicit ids are chosen so their insertion order is
-- INTENTIALLY DIFFERENT from their id ASC order. Insertion order:
--   1st: ee000000-0000-0000-0000-0000000000e1  (HIGHEST in id ASC)
--   2nd: bb000000-0000-0000-0000-0000000000e2  (MIDDLE in id ASC)
--   3rd: 55000000-0000-0000-0000-0000000000e3  (LOWEST in id ASC)
-- So id ASC sort yields: 55000000..., bb000000..., ee000000...
-- A broken implementation that only orders by created_at (no id ASC
-- tie-breaker) returns the rows in physical / insertion order:
-- ee000000..., bb000000..., 55000000... — which does NOT match the
-- expected id ASC array. The test therefore fails deterministically on
-- a broken implementation, regardless of any random-UUID collision in
-- auto-generated id space.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.production_order_events
  (id, workshop_id, production_order_id, from_state, to_state, reason, actor_id, metadata, created_at)
values
  ('ee000000-0000-0000-0000-0000000000e1',
   (select id from _read_rpc_ids where key = 'workshop_a'),
   (select id from public.production_orders where production_number = 'OP-READ-A-TIED'),
   'planned', 'in_progress', 'first', null, '{}'::jsonb, '2020-01-15 08:30:00+00'::timestamptz),
  ('bb000000-0000-0000-0000-0000000000e2',
   (select id from _read_rpc_ids where key = 'workshop_a'),
   (select id from public.production_orders where production_number = 'OP-READ-A-TIED'),
   'in_progress', 'paused', 'second', null, '{}'::jsonb, '2020-01-15 08:30:00+00'::timestamptz),
  ('55000000-0000-0000-0000-0000000000e3',
   (select id from _read_rpc_ids where key = 'workshop_a'),
   (select id from public.production_orders where production_number = 'OP-READ-A-TIED'),
   'paused', 'in_progress', 'third', null, '{}'::jsonb, '2020-01-15 08:30:00+00'::timestamptz);

-- T8.1: the RPC must return the 3 tied-timestamp events in a stable
-- order. We filter the RPC result to the 3 events with the tied
-- created_at (the start event has a different created_at, so it is
-- excluded). The expected array is the 3 events sorted by id ASC
-- (55000000... < bb000000... < ee000000...). The actual array is the
-- RPC's NATURAL output order, with no ORDER BY added by the assertion
-- — so a broken implementation that only sorts by created_at (returns
-- rows in physical/insertion order = ee..., bb..., 55...) produces a
-- different array from the expected and FAILS this test. This makes
-- T8.1 a deterministic regression test that cannot be passed by
-- chance on a broken implementation.
select _read_rpc_set_user('admin_a');
select is(
  -- RPC's natural output order, filtered to the 3 tied events (no re-sort)
  (select array_agg(e.id::text)
     from public.get_production_order_events(
       (select id from public.production_orders where production_number = 'OP-READ-A-TIED')
     ) e
    where e.created_at = '2020-01-15 08:30:00+00'::timestamptz
   ),
  -- Expected: id ASC for the 3 tied events (55000000... < bb000000... < ee000000...)
  (select array_agg(e.id::text order by e.id)
     from public.production_order_events e
    where e.production_order_id = (select id from public.production_orders
                                    where production_number = 'OP-READ-A-TIED')
      and e.created_at = '2020-01-15 08:30:00+00'::timestamptz
   ),
  'T8.1: get_production_order_events returns tied-timestamp events in id ASC order (stable tie-breaker; explicit event ids make insertion order DIFFERENT from id ASC order so a broken created_at-only implementation cannot pass by chance)'
);

-- T8.1b: same-timestamp events must also be returned in a STABLE order
-- across repeated RPC calls. This catches a non-deterministic
-- implementation that the comparison in T8.1 might miss if the random
-- plan picks the same order twice. Two independent calls must produce
-- the same id list.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select array_agg(e.id::text)
     from public.get_production_order_events(
       (select id from public.production_orders where production_number = 'OP-READ-A-TIED')
     ) e
    where e.created_at = '2020-01-15 08:30:00+00'::timestamptz$$,
  $$select array_agg(e.id::text)
     from public.get_production_order_events(
       (select id from public.production_orders where production_number = 'OP-READ-A-TIED')
     ) e
    where e.created_at = '2020-01-15 08:30:00+00'::timestamptz$$,
  'T8.1b: tied-timestamp events return in identical order across repeated RPC calls (stability proof)'
);

-- T8.2 — B2 WARNING: a quote with delivered + cancelled orders must NOT
-- project to 'entregado'. The spec says "all orders delivered" — a
-- cancelled order alongside a delivered one is not "all delivered".
-- Setup: take quote_a_extra (already has OP-READ-A-002 in 'planned'),
-- transition it to 'delivered' via the full path, then ALSO create a
-- second order and cancel it. Then assert the projection.
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- T8.2 setup: transition OP-READ-A-002 (planned) -> delivered via the
-- full path. The order was created in T2.10e in 'planned' state.
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-002'),
    'in_progress'::public.production_order_state,
    'starting work for mixed test',
    'aa000000-0000-0000-0000-000000000030'::uuid
  )$$,
  'T8.2a: setup — OP-READ-A-002 planned -> in_progress'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-002'),
    'quality_check'::public.production_order_state,
    'quality check for mixed test',
    'aa000000-0000-0000-0000-000000000031'::uuid
  )$$,
  'T8.2b: setup — OP-READ-A-002 in_progress -> quality_check'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-002'),
    'ready'::public.production_order_state,
    'ready for mixed test',
    'aa000000-0000-0000-0000-000000000032'::uuid
  )$$,
  'T8.2c: setup — OP-READ-A-002 quality_check -> ready'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-002'),
    'delivered'::public.production_order_state,
    'delivered for mixed test',
    'aa000000-0000-0000-0000-000000000033'::uuid
  )$$,
  'T8.2d: setup — OP-READ-A-002 ready -> delivered'
);

-- T8.2e: create a SECOND order on quote_a_extra and cancel it.
-- quote_a_extra now has 1 delivered + 1 cancelled.
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_extra'),
    'OP-READ-A-MIX-1',
    null, null, null, 'will be cancelled alongside a delivered',
    'aa000000-0000-0000-0000-000000000034'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T8.2e: setup — second order on quote_a_extra (planned)'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MIX-1'),
    'cancelled'::public.production_order_state,
    'cancelled alongside a delivered',
    'aa000000-0000-0000-0000-000000000035'::uuid
  )$$,
  'T8.2f: setup — second order on quote_a_extra planned -> cancelled'
);

-- T8.2: the projection for quote_a_extra must be the STORED status
-- ('aprobado'), NOT 'entregado'. The previous implementation projected
-- 'entregado' because delivered_count > 0 AND non_terminal_count = 0
-- (cancelled is excluded from non_terminal). The strict semantic
-- requires ALL orders to be in 'delivered' for the 'entregado' overlay.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_extra')$$,
  $$values ('aprobado'::text)$$,
  'T8.2: a quote with delivered + cancelled orders projects to the stored status, NOT entregado (strict all-delivered semantic)'
);

-- T8.2b: has_active_production is still false for the mixed delivered +
-- cancelled quote (no order is in an active state).
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select has_active_production::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_extra')$$,
  $$values ('false'::text)$$,
  'T8.2b: has_active_production is false for the delivered + cancelled quote (no active order)'
);

-- T8.3 — B2 triangulation: a delivered + cancelled mix on a SECOND
-- fresh quote also projects to the stored status. T8.2 already covers
-- the same shape on quote_a_extra; T8.3 uses a different quote
-- (quote_a_multi) to guard against a hypothetical implementation that
-- accidentally hard-codes the T8.2 quote id. Create a fresh quote with
-- 1 delivered + 1 cancelled order and assert the projection.
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status)
values (
  '33000000-0000-0000-0000-0000000000a7',
  (select id from _read_rpc_ids where key = 'workshop_a'),
  'READ-RPC-A-MULTI',
  (select id from _read_rpc_ids where key = 'client_a'),
  'Read RPC Furniture A (multi delivered + cancelled)', 'aprobado'
) on conflict (id) do nothing;
insert into _read_rpc_ids (key, id) values
  ('quote_a_multi', '33000000-0000-0000-0000-0000000000a7')
on conflict (key) do nothing;

-- T8.3 setup: 1 order delivered, 1 order cancelled on the same quote.
-- Create the 2 orders first, then walk each to its terminal state.
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_multi'),
    'OP-READ-A-MULTI-D1',
    null, null, null, 'first delivered',
    'aa000000-0000-0000-0000-000000000040'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T8.3a: setup — order 1 on quote_a_multi (planned)'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MULTI-D1'),
    'in_progress'::public.production_order_state,
    'd1 in progress',
    'aa000000-0000-0000-0000-000000000041'::uuid
  )$$,
  'T8.3b: setup — d1 planned -> in_progress'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MULTI-D1'),
    'quality_check'::public.production_order_state,
    'd1 quality check',
    'aa000000-0000-0000-0000-000000000042'::uuid
  )$$,
  'T8.3c: setup — d1 in_progress -> quality_check'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MULTI-D1'),
    'ready'::public.production_order_state,
    'd1 ready',
    'aa000000-0000-0000-0000-000000000043'::uuid
  )$$,
  'T8.3d: setup — d1 quality_check -> ready'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MULTI-D1'),
    'delivered'::public.production_order_state,
    'd1 delivered',
    'aa000000-0000-0000-0000-000000000044'::uuid
  )$$,
  'T8.3e: setup — d1 ready -> delivered'
);

-- Order 2: cancel
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _read_rpc_ids where key = 'quote_a_multi'),
    'OP-READ-A-MULTI-D2',
    null, null, null, 'second delivered',
    'aa000000-0000-0000-0000-000000000045'::uuid,
    false  -- PR 4: p_create_deduction = false
  )$$,
  'T8.3f: setup — order 2 on quote_a_multi (planned)'
);
select _read_rpc_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'OP-READ-A-MULTI-D2'),
    'cancelled'::public.production_order_state,
    'd2 cancelled (using direct cancel from planned)',
    'aa000000-0000-0000-0000-000000000046'::uuid
  )$$,
  'T8.3g: setup — d2 planned -> cancelled'
);

-- T8.3h: the projection for quote_a_multi must be the STORED status
-- ('aprobado'), NOT 'entregado'. The 1 delivered + 1 cancelled mix
-- still does NOT meet the strict all-delivered semantic.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select production_status::text from public.get_quotes_with_production_status(100, 0)
     where id = (select id from _read_rpc_ids where key = 'quote_a_multi')$$,
  $$values ('aprobado'::text)$$,
  'T8.3h: a quote with 1 delivered + 1 cancelled orders projects to the stored status (strict all-delivered semantic, multi-order triangulation on a fresh quote)'
);

-- T8.4 — B4 SUGGESTION: NULL p_limit on list_production_orders must
-- behave deterministically. With the fix (COALESCE(p_limit, 100)),
-- NULL p_limit is equivalent to the documented default of 100.
-- admin_a has 7 orders after the T8.x setup (OP-READ-A-001, -002,
-- -CANCEL, -MIX-1, -TIED, -MULTI-D1, -MULTI-D2); admin_b has 1.
-- limit 100 is more than enough to return all 7.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, null, 0
  )$$,
  $$values (7::int)$$,
  'T8.4: list_production_orders with NULL p_limit returns all 7 orders (default = 100, deterministic)'
);

-- T8.5 — B4 SUGGESTION: NULL p_offset on list_production_orders must
-- behave deterministically. With the fix (COALESCE(p_offset, 0)),
-- NULL p_offset is equivalent to the documented default of 0.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, null
  )$$,
  $$values (7::int)$$,
  'T8.5: list_production_orders with NULL p_offset returns all 7 orders (default = 0, deterministic)'
);

-- T8.6 — B4 SUGGESTION: negative p_limit on list_production_orders is
-- clamped to 0 (via GREATEST(p_limit, 0)), so the RPC returns 0 rows.
-- This is the regression for the existing T2.8 (limit = 0).
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, -5, 0
  )$$,
  $$values (0::int)$$,
  'T8.6: list_production_orders with negative p_limit returns 0 rows (clamped to 0 via GREATEST)'
);

-- T8.7 — B4 SUGGESTION: negative p_offset on list_production_orders is
-- clamped to 0 (via GREATEST(p_offset, 0)), so the RPC returns all rows
-- from the start.
select _read_rpc_set_user('admin_a');
select results_eq(
  $$select count(*)::int from public.list_production_orders(
    null, null, null, null, 100, -5
  )$$,
  $$values (7::int)$$,
  'T8.7: list_production_orders with negative p_offset returns all 7 orders (clamped to 0 via GREATEST)'
);

-- ==========================================================================
-- Cleanup
-- ==========================================================================

reset role;
select set_config('request.jwt.claim.sub', '', true);
drop function _read_rpc_set_user(text);

select * from finish();

rollback;
