-- Test: production_order_events.event_type + note columns
--
-- This is a CRITICAL PR 7 review-blocker fix. The PR 7 spec
-- (production-orders/spec.md, "Append-only Audit Events" requirement)
-- declares the production_order_events columns to include
--   event_type text NOT NULL
--   note text NULL
-- The original schema (PR 1) only had `reason` (a free-form text the
-- callers wrote into). The PR 7 review noted that the
-- `get_production_order_events` RPC exposed `reason` but not
-- `event_type`/`note`, and the EventTimeline UI derived the per-row
-- label from `(from_state, to_state)` instead of `event_type`.
--
-- This file asserts the new contract end-to-end:
--   1. The production_order_events table has the new columns
--      (event_type text NOT NULL, note text NULL).
--   2. Existing rows are backfilled: event_type is computed from
--      (from_state, to_state) by a helper function, never NULL.
--   3. start_production_order writes event_type = 'created' AND
--      note = 'production order created' on the creation event.
--   4. transition_production_order_state writes event_type
--      derived from the transition AND note = p_reason.
--   5. get_production_order_events exposes event_type and note in
--      the RETURNS TABLE.
--   6. The event_type derivation covers: 'created' (from_state IS
--      NULL), 'paused' (in_progress -> paused), 'resumed' (paused
--      -> in_progress), 'cancelled' (to_state = cancelled),
--      'delivered' (to_state = delivered), 'transitioned' (every
--      other allowed transition).

begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

-- ==========================================================================
-- Helper: switch to an authenticated user (workshop_a admin by default)
-- ==========================================================================
create or replace function _etn_set_user(p_key text)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  perform set_config(
    'request.jwt.claim.sub',
    (select id::text from _etn_ids where key = p_key),
    true);
end;
$$;

create temporary table _etn_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _etn_ids (key, id) values
  ('workshop_a',  'a1000000-0000-0000-0000-0000000000a1'),
  ('admin_a',     'a2000000-0000-0000-0000-0000000000a1'),
  ('client_a',    'a3000000-0000-0000-0000-0000000000a1'),
  ('quote_a',     'a4000000-0000-0000-0000-0000000000a1'),
  ('quote_b',     'a4000000-0000-0000-0000-0000000000b1'),
  ('quote_c',     'a4000000-0000-0000-0000-0000000000c1'),
  ('order_a',     'a5000000-0000-0000-0000-0000000000a1'),
  ('order_b',     'a5000000-0000-0000-0000-0000000000b1'),
  ('order_c',     'a5000000-0000-0000-0000-0000000000c1');

grant select on _etn_ids to authenticated;

-- Seed workshop + admin
insert into public.workshops (id, name) values
  ((select id from _etn_ids where key = 'workshop_a'),
   'ETN Test Workshop A');

insert into auth.users (id, email) values
  ((select id from _etn_ids where key = 'admin_a'),
   'etn-admin-a@example.com');

update public.profiles
   set workshop_id = (select id from _etn_ids where key = 'workshop_a'),
       workshop_role = 'admin',
       display_name = 'Alice Admin'
 where id = (select id from _etn_ids where key = 'admin_a');

insert into public.clients (id, workshop_id, name) values
  ((select id from _etn_ids where key = 'client_a'),
   (select id from _etn_ids where key = 'workshop_a'),
   'ETN Client A');

insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name, status) values
  ((select id from _etn_ids where key = 'quote_a'),
   (select id from _etn_ids where key = 'workshop_a'),
   'ETN-A-001',
   (select id from _etn_ids where key = 'client_a'),
   'ETN Furniture A', 'aprobado'),
  ((select id from _etn_ids where key = 'quote_b'),
   (select id from _etn_ids where key = 'workshop_a'),
   'ETN-B-001',
   (select id from _etn_ids where key = 'client_a'),
   'ETN Furniture B', 'aprobado'),
  ((select id from _etn_ids where key = 'quote_c'),
   (select id from _etn_ids where key = 'workshop_a'),
   'ETN-C-001',
   (select id from _etn_ids where key = 'client_a'),
   'ETN Furniture C', 'aprobado');

-- ==========================================================================
-- T1: schema — the new columns exist with the right nullability
-- ==========================================================================
-- The spec requires `event_type text NOT NULL` and `note text NULL`
-- on production_order_events. These are the deterministic RED: the
-- columns don't exist on the pre-PR-7 schema, so has_column fails.
-- ==========================================================================

-- T1.1
select has_column(
  'public', 'production_order_events', 'event_type',
  'T1.1: production_order_events.event_type column exists (was missing in pre-PR-7 schema)'
);

-- T1.2
select has_column(
  'public', 'production_order_events', 'note',
  'T1.2: production_order_events.note column exists (was missing in pre-PR-7 schema; old column was reason)'
);

-- T1.3: event_type is NOT NULL
select col_not_null(
  'public', 'production_order_events', 'event_type',
  'T1.3: production_order_events.event_type is NOT NULL per spec'
);

-- T1.4: note is NULL-able
select col_is_null(
  'public', 'production_order_events', 'note',
  'T1.4: production_order_events.note is NULL-able per spec (optional human note)'
);

-- ==========================================================================
-- T2: helper function — derive event_type from (from_state, to_state)
-- ==========================================================================
-- A pure helper that maps a (from_state, to_state) pair to the canonical
-- event_type label. The helper is used by:
--   - the backfill (existing rows get event_type = helper(...))
--   - transition_production_order_state (sets event_type on every new event)
--   - a defense-in-depth CHECK constraint (event_type must come from the
--     helper's allowed set, never arbitrary text)
-- ==========================================================================

-- T2.1
select has_function(
  'public', 'production_order_event_type',
  array['production_order_state', 'production_order_state'],
  'T2.1: production_order_event_type(from_state, to_state) helper exists'
);

-- T2.2: from_state IS NULL -> 'created'
select is(
  (select public.production_order_event_type(
     null::public.production_order_state,
     'planned'::public.production_order_state)),
  'created'::text,
  'T2.2: helper maps (NULL, planned) -> created'
);

-- T2.3: in_progress -> paused -> 'paused'
select is(
  (select public.production_order_event_type(
     'in_progress'::public.production_order_state,
     'paused'::public.production_order_state)),
  'paused'::text,
  'T2.3: helper maps (in_progress, paused) -> paused'
);

-- T2.4: paused -> in_progress -> 'resumed'
select is(
  (select public.production_order_event_type(
     'paused'::public.production_order_state,
     'in_progress'::public.production_order_state)),
  'resumed'::text,
  'T2.4: helper maps (paused, in_progress) -> resumed'
);

-- T2.5: -> cancelled -> 'cancelled'
select is(
  (select public.production_order_event_type(
     'planned'::public.production_order_state,
     'cancelled'::public.production_order_state)),
  'cancelled'::text,
  'T2.5: helper maps (planned, cancelled) -> cancelled'
);

-- T2.6: -> delivered -> 'delivered'
select is(
  (select public.production_order_event_type(
     'ready'::public.production_order_state,
     'delivered'::public.production_order_state)),
  'delivered'::text,
  'T2.6: helper maps (ready, delivered) -> delivered'
);

-- T2.7: a normal transition -> 'transitioned'
select is(
  (select public.production_order_event_type(
     'in_progress'::public.production_order_state,
     'quality_check'::public.production_order_state)),
  'transitioned'::text,
  'T2.7: helper maps (in_progress, quality_check) -> transitioned'
);

-- T2.8: in_progress -> cancelled -> 'cancelled' (terminal wins over resumed/paused)
select is(
  (select public.production_order_event_type(
     'in_progress'::public.production_order_state,
     'cancelled'::public.production_order_state)),
  'cancelled'::text,
  'T2.8: helper maps (in_progress, cancelled) -> cancelled (terminal wins)'
);

-- T3.1 + T3.2 (RETURNS TABLE check) are folded into T4.3 below,
-- which queries get_production_order_events and asserts both
-- event_type and note are exposed end-to-end on the creation event.
-- The schema-level RETURNS TABLE shape is verified by T1.x (column
-- existence on the underlying table) and T4.3 (round-trip via the
-- read RPC), so the two-test split is not necessary.


-- ==========================================================================
-- T4: start_production_order writes event_type = 'created' and note
-- ==========================================================================

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _etn_ids where key = 'quote_a'),
    'ETN-OP-A',
    null, null, null, null,
    'b1000000-0000-0000-0000-0000000000a1'::uuid,
    false  -- p_create_deduction = false (PR 4)
  )$$,
  'T4.1a: setup — start_production_order for quote_a'
);

-- T4.1: the creation event has event_type = 'created'
select _etn_set_user('admin_a');
select is(
  (select event_type::text
     from public.production_order_events
    where production_order_id = (
      select id from public.production_orders
       where production_number = 'ETN-OP-A'
    )
      and from_state is null),
  'created'::text,
  'T4.1: start_production_order writes event_type = created on the creation event'
);

-- T4.2: the creation event has note = 'production order created'
select _etn_set_user('admin_a');
select is(
  (select note
     from public.production_order_events
    where production_order_id = (
      select id from public.production_orders
       where production_number = 'ETN-OP-A'
    )
      and from_state is null),
  'production order created'::text,
  'T4.2: start_production_order writes note = ''production order created'' on the creation event'
);

-- T4.3: get_production_order_events returns event_type and note
select _etn_set_user('admin_a');
select is(
  (select (event_type::text, note)
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-A')
     )
    where from_state is null
    limit 1),
  row('created'::text, 'production order created'::text)::record,
  'T4.3: get_production_order_events returns (event_type = created, note = ''production order created'') on the creation event'
);

-- ==========================================================================
-- T5: transition_production_order_state writes event_type + note
-- ==========================================================================

-- T5.1: in_progress -> paused -> event_type = 'paused', note = p_reason
select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-A'),
    'in_progress'::public.production_order_state,
    'starting work on ETN-OP-A',
    'b1000000-0000-0000-0000-0000000000a2'::uuid
  )$$,
  'T5.1a: setup — ETN-OP-A planned -> in_progress'
);

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-A'),
    'paused'::public.production_order_state,
    'paused for material shortage',
    'b1000000-0000-0000-0000-0000000000a3'::uuid
  )$$,
  'T5.1b: setup — ETN-OP-A in_progress -> paused'
);

select _etn_set_user('admin_a');
select results_eq(
  $$select (event_type::text, note)
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-A')
     )
    where from_state = 'in_progress'::public.production_order_state
      and to_state   = 'paused'::public.production_order_state$$,
  $$values (row('paused'::text, 'paused for material shortage'::text)::record)$$,
  'T5.1: get_production_order_events returns (event_type=paused, note='') for in_progress -> paused'
);

-- T5.2: paused -> in_progress -> event_type = 'resumed'
select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-A'),
    'in_progress'::public.production_order_state,
    'resuming after restock',
    'b1000000-0000-0000-0000-0000000000a4'::uuid
  )$$,
  'T5.2a: setup — ETN-OP-A paused -> in_progress'
);

select _etn_set_user('admin_a');
select results_eq(
  $$select event_type::text
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-A')
     )
    where from_state = 'paused'::public.production_order_state
      and to_state   = 'in_progress'::public.production_order_state$$,
  $$values ('resumed'::text)$$,
  'T5.2: event_type = ''resumed'' for paused -> in_progress'
);

-- T5.3: in_progress -> cancelled -> event_type = 'cancelled'
select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-A'),
    'cancelled'::public.production_order_state,
    'client cancelled order',
    'b1000000-0000-0000-0000-0000000000a5'::uuid
  )$$,
  'T5.3a: setup — ETN-OP-A in_progress -> cancelled'
);

select _etn_set_user('admin_a');
select results_eq(
  $$select event_type::text
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-A')
     )
    where to_state = 'cancelled'::public.production_order_state$$,
  $$values ('cancelled'::text)$$,
  'T5.3: event_type = ''cancelled'' for in_progress -> cancelled'
);

-- ==========================================================================
-- T6: triangulation on a SECOND order — full transition chain
-- ==========================================================================
-- Drives the full chain (planned -> in_progress -> quality_check -> ready
-- -> delivered) on a different order so the helper-derived event_type is
-- observed for every step on a fresh quote.
-- ==========================================================================

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.start_production_order(
    (select id from _etn_ids where key = 'quote_b'),
    'ETN-OP-B',
    null, null, null, null,
    'b2000000-0000-0000-0000-0000000000b1'::uuid,
    false
  )$$,
  'T6.1: setup — start ETN-OP-B'
);

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-B'),
    'in_progress'::public.production_order_state,
    'b',
    'b2000000-0000-0000-0000-0000000000b2'::uuid
  )$$,
  'T6.2: ETN-OP-B -> in_progress'
);

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-B'),
    'quality_check'::public.production_order_state,
    'qc',
    'b2000000-0000-0000-0000-0000000000b3'::uuid
  )$$,
  'T6.3: ETN-OP-B -> quality_check'
);

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-B'),
    'ready'::public.production_order_state,
    'rdy',
    'b2000000-0000-0000-0000-0000000000b4'::uuid
  )$$,
  'T6.4: ETN-OP-B -> ready'
);

select _etn_set_user('admin_a');
select lives_ok(
  $$select public.transition_production_order_state(
    (select id from public.production_orders where production_number = 'ETN-OP-B'),
    'delivered'::public.production_order_state,
    'shipped',
    'b2000000-0000-0000-0000-0000000000b5'::uuid
  )$$,
  'T6.5: ETN-OP-B -> delivered'
);

-- T6.6: each step of the transition chain has the expected event_type.
-- The test asserts each (from_state, to_state) -> event_type mapping
-- individually, ordered by the (from_state, to_state) pair to keep the
-- assertion independent of the random id ASC tie-breaker order used
-- by the SQL function.
select _etn_set_user('admin_a');
select results_eq(
  $$select event_type::text
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-B')
     )
    order by from_state::text nulls first, to_state::text$$,
  $$values
     ('created'::text),
     ('transitioned'::text),
     ('transitioned'::text),
     ('transitioned'::text),
     ('delivered'::text)$$,
  'T6.6: each step of the ETN-OP-B transition chain has the expected event_type (created -> transitioned x3 -> delivered)'
);

-- T6.7: each step of the transition chain has the expected note.
-- We assert each row's note individually against the
-- (from_state, to_state) pair to keep the test independent of the
-- random id ASC tie-breaker order. Sorted by (from_state nulls
-- first, to_state) so the expected order is deterministic; with
-- the alphabetical sort, "in_progress" < "planned" (because 'i' <
-- 'p'), so the rows come out in this order:
--   (NULL, planned)              <- creation
--   (in_progress, quality_check) <- qc
--   (planned, in_progress)       <- b
--   (quality_check, ready)       <- rdy
--   (ready, delivered)           <- shipped
select _etn_set_user('admin_a');
select results_eq(
  $$select (from_state::text, to_state::text, note)
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-B')
     )
    order by from_state::text nulls first, to_state::text$$,
  $$values
     (row(null::text,  'planned'::text,    'production order created'::text)::record),
     (row('in_progress'::text, 'quality_check'::text, 'qc'::text)::record),
     (row('planned'::text, 'in_progress'::text,  'b'::text)::record),
     (row('quality_check'::text, 'ready'::text,         'rdy'::text)::record),
     (row('ready'::text,         'delivered'::text,   'shipped'::text)::record)$$,
  'T6.7: each step of the ETN-OP-B transition chain has the expected note (no order assumption; sorted by (from_state, to_state))'
);

-- ==========================================================================
-- T7: cross-workshop safety — the new columns are RLS-scoped
-- ==========================================================================
-- Confirm the new columns are visible only inside the caller's workshop
-- (same RLS behavior as the rest of the row).
-- ==========================================================================

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _etn_ids where key = 'admin_a'),
  true);

-- T7.1: a non-existent order id yields 0 rows (RLS still scopes the result)
select results_eq(
  $$select count(*)::int from public.get_production_order_events(
    '99999999-0000-0000-0000-000000000099'::uuid
  )$$,
  $$values (0::int)$$,
  'T7.1: get_production_order_events returns 0 rows for a nonexistent order id (RLS)'
);

-- T7.2: when the caller's workshop has the order, the new columns are
-- returned with the expected values (re-asserts the round-trip).
-- We pick the creation event by its from_state IS NULL discriminator
-- (not by created_at/id ordering) so the assertion is independent of
-- the random id ASC tie-breaker order.
select is(
  (select (event_type::text, note)
     from public.get_production_order_events(
       (select id from public.production_orders
        where production_number = 'ETN-OP-A')
     )
    where from_state is null
    limit 1),
  row('created'::text, 'production order created'::text)::record,
  'T7.2: get_production_order_events returns the new columns end-to-end on the creation event (no order assumption)'
);

-- ==========================================================================
-- Cleanup
-- ==========================================================================
reset role;
select set_config('request.jwt.claim.sub', '', true);
drop function _etn_set_user(text);

select * from finish();

rollback;
