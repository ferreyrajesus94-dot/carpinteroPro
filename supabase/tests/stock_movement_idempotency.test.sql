-- Test: reverse_stock_movement idempotency via p_reversal_request_id
--
-- The RPC supports an optional p_reversal_request_id UUID that, when
-- provided, makes the operation idempotent: a second call with the same
-- request id returns the existing reversal movement id instead of creating
-- a duplicate. This is critical for safe retries from a flaky network or
-- a double-clicked "Revertir" button. The lookup uses
-- stock_movements_reversal_request_idx (workshop_id, reversal_request_id).

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

create temporary table _test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-000000000001'),
  ('admin_a',    '20000000-0000-0000-0000-000000000001'),
  ('material_a', '30000000-0000-0000-0000-000000000001'),
  ('movement_a', '40000000-0000-0000-0000-000000000001'),
  ('request_id', '50000000-0000-0000-0000-000000000001');

grant select on _test_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from _test_ids where key = 'admin_a'), 'admin_a@example.com');

insert into public.workshops (id, name) values
  ((select id from _test_ids where key = 'workshop_a'), 'Idempotency Workshop');

update public.profiles set workshop_id = (select id from _test_ids where key = 'workshop_a')
where id = (select id from _test_ids where key = 'admin_a');
update public.profiles set workshop_role = 'admin'::public.workshop_user_role
where id = (select id from _test_ids where key = 'admin_a');

insert into public.materials (id, workshop_id, name, unit, stock)
values
  ((select id from _test_ids where key = 'material_a'),
   (select id from _test_ids where key = 'workshop_a'),
   'Madera idempotencia', 'un', 10);

insert into public.stock_movements (
  id, workshop_id, material_id, delta, reason
)
select
  (select id from _test_ids where key = 'movement_a'),
  (select id from _test_ids where key = 'workshop_a'),
  (select id from _test_ids where key = 'material_a'),
  5, 'compra'::public.stock_movement_reason;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _test_ids where key = 'admin_a'),
  true);

-- T1.1: first call creates the reversal and returns the new id; capture it
create temporary table _first_reversal (id uuid) on commit drop;
insert into _first_reversal (id)
select reverse_stock_movement(
  (select id from _test_ids where key = 'movement_a'),
  'Idempotency test reversal',
  (select id from _test_ids where key = 'request_id')
);

-- T1.2: only one reversal row exists for the request id (the first call
-- created it; later calls with the same id must not create another)
select is(
  (select count(*) from public.stock_movements
    where reversal_request_id = (select id from _test_ids where key = 'request_id'))::text,
  '1',
  'T1.1: exactly one reversal row exists for the request id'
);

-- T1.3: a second call with the same request id returns the SAME reversal id
select is(
  (select reverse_stock_movement(
     (select id from _test_ids where key = 'movement_a'),
     'Idempotency test reversal (retry)',
     (select id from _test_ids where key = 'request_id')
   ))::text,
  (select id::text from _first_reversal),
  'T1.2: second call with same request id returns the existing reversal id (no new row)'
);

-- T1.4: a third call with a different request id is rejected because the
-- original movement is already reversed (unique index raises 23505)
select throws_ok(
  $$select reverse_stock_movement(
     (select id from _test_ids where key = 'movement_a'),
     'Idempotency test reversal (different request id, already reversed)',
     '60000000-0000-0000-0000-000000000001'::uuid
   )$$,
  '23505',
  null,
  'T1.3: third call with a different request id is rejected because the movement is already reversed'
);

select * from finish();
rollback;
