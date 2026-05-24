begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

create temporary table _tenant_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _tenant_test_ids (key, id) values
  ('workshop_a', '10000000-0000-0000-0000-000000000001'),
  ('workshop_b', '10000000-0000-0000-0000-000000000002'),
  ('user_a', '20000000-0000-0000-0000-000000000001'),
  ('user_b', '20000000-0000-0000-0000-000000000002'),
  ('user_without_profile', '20000000-0000-0000-0000-000000000003'),
  ('material_a', '30000000-0000-0000-0000-000000000001'),
  ('client_a', '40000000-0000-0000-0000-000000000001'),
  ('quote_a', '50000000-0000-0000-0000-000000000001'),
  ('task_a', '60000000-0000-0000-0000-000000000001'),
  ('stock_movement_a', '70000000-0000-0000-0000-000000000001');

grant select on _tenant_test_ids to authenticated;

select ok(
  to_regprocedure('public.get_current_workshop_id()') is not null,
  'get_current_workshop_id() exists'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and i.indisprimary
  ),
  'profiles(id) has a primary key index'
);

select results_eq(
  $$
    select count(*)::bigint
    from (values
      ('materials'),
      ('price_history'),
      ('furniture_templates'),
      ('clients'),
      ('quotes'),
      ('contract_templates'),
      ('workshop_settings'),
      ('stock_movements'),
      ('tasks'),
      ('cut_pieces'),
      ('recipe_items'),
      ('labor_items'),
      ('quote_extras'),
      ('quote_recipe_snapshots'),
      ('quote_labor_snapshots')
    ) as tenant_tables(table_name)
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = tenant_tables.table_name
     and c.column_name = 'workshop_id'
     and c.udt_name = 'uuid'
     and c.is_nullable = 'NO'
    where c.column_name is null
  $$,
  array[0::bigint],
  'tenant-scoped tables expose workshop_id uuid not null'
);

insert into public.workshops (id, name) values
  ((select id from _tenant_test_ids where key = 'workshop_a'), 'Tenant Test Workshop A'),
  ((select id from _tenant_test_ids where key = 'workshop_b'), 'Tenant Test Workshop B');

insert into auth.users (id, email) values
  ((select id from _tenant_test_ids where key = 'user_a'), 'tenant-test-a@example.com'),
  ((select id from _tenant_test_ids where key = 'user_b'), 'tenant-test-b@example.com'),
  ((select id from _tenant_test_ids where key = 'user_without_profile'), 'tenant-test-missing-profile@example.com');

update public.profiles
set workshop_id = (select id from _tenant_test_ids where key = 'workshop_a')
where id = (select id from _tenant_test_ids where key = 'user_a');

update public.profiles
set workshop_id = (select id from _tenant_test_ids where key = 'workshop_b')
where id = (select id from _tenant_test_ids where key = 'user_b');

delete from public.profiles
where id = (select id from _tenant_test_ids where key = 'user_without_profile');

insert into public.materials (id, workshop_id, name, category, unit, price_per_unit, stock, min_stock)
values (
  (select id from _tenant_test_ids where key = 'material_a'),
  (select id from _tenant_test_ids where key = 'workshop_a'),
  'Tenant Test Material A',
  'madera',
  'un',
  10,
  5,
  0
);

insert into public.clients (id, workshop_id, name)
values (
  (select id from _tenant_test_ids where key = 'client_a'),
  (select id from _tenant_test_ids where key = 'workshop_a'),
  'Tenant Test Client A'
);

insert into public.quotes (id, workshop_id, quote_number, client_id, furniture_name)
values (
  (select id from _tenant_test_ids where key = 'quote_a'),
  (select id from _tenant_test_ids where key = 'workshop_a'),
  'T-0001',
  (select id from _tenant_test_ids where key = 'client_a'),
  'Tenant Test Furniture'
);

insert into public.tasks (id, workshop_id, title)
values (
  (select id from _tenant_test_ids where key = 'task_a'),
  (select id from _tenant_test_ids where key = 'workshop_a'),
  'Tenant Test Task A'
);

insert into public.stock_movements (id, workshop_id, material_id, delta, reason)
values (
  (select id from _tenant_test_ids where key = 'stock_movement_a'),
  (select id from _tenant_test_ids where key = 'workshop_a'),
  (select id from _tenant_test_ids where key = 'material_a'),
  1,
  'compra'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from _tenant_test_ids where key = 'user_b'), true);
select set_config(
  'request.headers',
  json_build_object('x-workshop-id', (select id::text from _tenant_test_ids where key = 'workshop_a'))::text,
  true
);

select results_eq(
  $$select count(*)::bigint from public.materials where name = 'Tenant Test Material A'$$,
  array[0::bigint],
  'forged x-workshop-id header cannot expose another workshop materials row'
);

select results_eq(
  $$select count(*)::bigint from public.stock_movements where id = '70000000-0000-0000-0000-000000000001'::uuid$$,
  array[0::bigint],
  'forged x-workshop-id header cannot expose another workshop stock movement row'
);

select set_config('request.jwt.claim.sub', (select id::text from _tenant_test_ids where key = 'user_a'), true);
select set_config(
  'request.headers',
  json_build_object('x-workshop-id', (select id::text from _tenant_test_ids where key = 'workshop_a'))::text,
  true
);

select throws_ok(
  $$
    update public.profiles
    set workshop_id = '10000000-0000-0000-0000-000000000002'::uuid
    where id = '20000000-0000-0000-0000-000000000001'::uuid
  $$,
  '42501',
  'profiles.workshop_id cannot be changed by authenticated users',
  'user A cannot change their own profile workshop_id'
);

select throws_ok(
  $$
    insert into public.materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock)
    values ('10000000-0000-0000-0000-000000000002'::uuid, 'Tenant Test Cross Insert', 'madera', 'un', 1, 0, 0)
  $$,
  '42501',
  'new row violates row-level security policy for table "materials"',
  'user A cannot insert a materials row for workshop B'
);

select throws_ok(
  $$
    update public.clients
    set workshop_id = '10000000-0000-0000-0000-000000000002'::uuid
    where id = '40000000-0000-0000-0000-000000000001'::uuid
  $$,
  '42501',
  'new row violates row-level security policy for table "clients"',
  'user A cannot update a client row into workshop B'
);

select results_eq(
  $$select count(*)::bigint from public.quotes where id = '50000000-0000-0000-0000-000000000001'::uuid$$,
  array[1::bigint],
  'user A can select own workshop quote row'
);

select results_eq(
  $$select count(*)::bigint from public.workshops where name like 'Tenant Test Workshop%'$$,
  array[1::bigint],
  'user A can only see own workshop row'
);

select set_config('request.jwt.claim.sub', (select id::text from _tenant_test_ids where key = 'user_without_profile'), true);
select set_config('request.headers', '{}'::text, true);

select results_eq(
  $$select count(*)::bigint from public.tasks where title = 'Tenant Test Task A'$$,
  array[0::bigint],
  'authenticated user without profile sees zero tenant task rows'
);

select * from finish();
rollback;
