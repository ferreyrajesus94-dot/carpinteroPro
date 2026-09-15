-- Test: handle_new_user founder lands with workshop_role = 'admin'.
-- Founder-admin contract from
-- docs/operations/production-readiness-audit-2026-09-13.md.
--
-- Today the column DEFAULT 'viewer' wins, blocking the founder
-- from any admin-scoped RPC and leaving a privilege-escalation
-- surface downstream. Post-migration the trigger must set
-- workshop_role = 'admin' explicitly for the workshop it just
-- created — and ignore every client-controlled key in
-- raw_user_meta_data that touches authority.
--
-- RED today: T1, T6 (DEFAULT 'viewer' instead of 'admin').
-- GREEN today (guard rails): T2, T3, T4, T5.
--
-- Authenticated role escalation is covered by
-- profile_admin_field_escalation.test.sql; viewer production
-- denial by production_deduction_rpc.test.sql; cross-tenant
-- isolation by cross_tenant_full_coverage.test.sql. This file
-- is scoped to the founder-bootstrap path only.
--
-- Planned forward-only migration (NOT yet applied):
--   supabase/migrations/20260913000003_workshop_founder_role.sql
--   -- Replaces handle_new_user preserving ALL referral/terms/
--   -- privacy/naming semantics. Only changes the profile INSERT
--   -- to set workshop_role = 'admin' explicitly for the workshop
--   -- created in the same trigger.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

create temporary table _founder_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _founder_ids (key, id) values
  ('plain',      'bb000000-0000-0000-0000-000000000001'),
  ('isolation_a','bb000000-0000-0000-0000-000000000002'),
  ('isolation_b','bb000000-0000-0000-0000-000000000003'),
  ('isolation_c','bb000000-0000-0000-0000-000000000004'),
  ('malicious',  'bb000000-0000-0000-0000-000000000005');

grant select on _founder_ids to authenticated, service_role;

-- T1+T2: plain founder (workshop_role admin RED today; is_platform_admin false)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  (select id from _founder_ids where key = 'plain'),
  'authenticated', 'authenticated', 'founder-plain@example.com',
  '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

select results_eq(
  $$
    select workshop_role::text
      from public.profiles
     where id = (select id from _founder_ids where key = 'plain')
  $$,
  array['admin'::text],
  'T1: founder signup lands with workshop_role = admin (RED today — DEFAULT viewer wins)'
);

select results_eq(
  $$
    select is_platform_admin
      from public.profiles
     where id = (select id from _founder_ids where key = 'plain')
  $$,
  array[false],
  'T2: founder is_platform_admin stays false (signup never grants platform privileges)'
);

-- T3: 3 founders → 3 distinct workshops (isolation)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   (select id from _founder_ids where key = 'isolation_a'),
   'authenticated', 'authenticated', 'founder-a@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _founder_ids where key = 'isolation_b'),
   'authenticated', 'authenticated', 'founder-b@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _founder_ids where key = 'isolation_c'),
   'authenticated', 'authenticated', 'founder-c@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select results_eq(
  $$
    select count(distinct workshop_id)::bigint
      from public.profiles
     where id in (
       (select id from _founder_ids where key = 'isolation_a'),
       (select id from _founder_ids where key = 'isolation_b'),
       (select id from _founder_ids where key = 'isolation_c')
     )
  $$,
  array[3::bigint],
  'T3: 3 founders land on 3 distinct workshops (handle_new_user creates a fresh workshop per signup)'
);

-- T4-T6: client metadata cannot escalate authority
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  (select id from _founder_ids where key = 'malicious'),
  'authenticated', 'authenticated', 'founder-malicious@example.com',
  '', now(),
  '{}'::jsonb,
  jsonb_build_object(
    'workshop_id',       '00000000-0000-0000-0000-000000000099',
    'is_platform_admin', true,
    'workshop_role',     'operational'
  ),
  now(), now()
);

select results_eq(
  $$
    select (workshop_id <> '00000000-0000-0000-0000-000000000099'::uuid)::boolean
      from public.profiles
     where id = (select id from _founder_ids where key = 'malicious')
  $$,
  array[true],
  'T4: malicious workshop_id in raw_user_meta_data is ignored (trigger always creates a fresh workshop)'
);

select results_eq(
  $$
    select is_platform_admin
      from public.profiles
     where id = (select id from _founder_ids where key = 'malicious')
  $$,
  array[false],
  'T5: malicious is_platform_admin in raw_user_meta_data is ignored (founder is not platform admin)'
);

select results_eq(
  $$
    select workshop_role::text
      from public.profiles
     where id = (select id from _founder_ids where key = 'malicious')
  $$,
  array['admin'::text],
  'T6: malicious workshop_role in raw_user_meta_data is ignored (founder always lands as admin of own workshop; RED today)'
);

select * from finish();
rollback;