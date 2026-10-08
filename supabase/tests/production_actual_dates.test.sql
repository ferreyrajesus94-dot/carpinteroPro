begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
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


select _etn_set_user('admin_a');
select public.start_production_order((select id from _etn_ids where key='quote_a'), 'DATES-A', null,null,null,null, gen_random_uuid(),false);
select public.start_production_order((select id from _etn_ids where key='quote_b'), 'DATES-B', null,null,null,null, gen_random_uuid(),false);
select ok((select actual_start_date is null and actual_end_date is null from public.production_orders where production_number='DATES-A'), 'planned has no actual dates');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'in_progress',null,gen_random_uuid());
select ok((select actual_start_date is not null and actual_end_date is null from public.production_orders where production_number='DATES-A'), 'starting writes only start date');
-- Use an older timestamp so resume would detect an accidental overwrite,
-- even though now() is constant inside this test transaction.
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.production_orders set actual_start_date='2026-01-01T00:00:00Z' where production_number='DATES-A';
select _etn_set_user('admin_a');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'paused','pause',gen_random_uuid());
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'in_progress','resume',gen_random_uuid());
select is((select actual_start_date from public.production_orders where production_number='DATES-A'), '2026-01-01T00:00:00Z'::timestamptz, 'resume preserves first start');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'quality_check',null,gen_random_uuid());
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'ready',null,gen_random_uuid());
select ok((select actual_end_date is null from public.production_orders where production_number='DATES-A'), 'ready is not terminal');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'delivered',null,'b1000000-0000-0000-0000-000000000099');
select ok((select actual_end_date is not null from public.production_orders where production_number='DATES-A'), 'delivery writes end');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.production_orders set actual_end_date='2026-01-02T00:00:00Z' where production_number='DATES-A';
select _etn_set_user('admin_a');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-A'), 'delivered',null,'b1000000-0000-0000-0000-000000000099');
select is((select actual_end_date from public.production_orders where production_number='DATES-A'), '2026-01-02T00:00:00Z'::timestamptz, 'idempotent retry preserves end');
select public.transition_production_order_state((select id from public.production_orders where production_number='DATES-B'), 'cancelled','cancel before work',gen_random_uuid());
select ok((select actual_start_date is null and actual_end_date is not null from public.production_orders where production_number='DATES-B'), 'cancel before start records end without inventing start');
select set_config('app.production_order_write_context','',true);
with attempted as (
 update public.production_orders set state='in_progress' where production_number='DATES-B' returning id
) select is(count(*)::int, 0, 'RLS prevents direct authenticated state writes') from attempted;
reset role;
select set_config('request.jwt.claim.sub','',true);
select ok((select not prosecdef from pg_proc where oid='public.set_production_order_actual_dates()'::regprocedure), 'trigger is invoker');
drop function _etn_set_user(text);
select * from finish();
rollback;
