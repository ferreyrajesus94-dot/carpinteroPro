-- Test: profile admin-field escalation is rejected at the trigger layer
--
-- Satisfies W3 acceptance criterion AC-4 from
-- docs/operations/production-readiness-audit-2026-09-13.md.
--
-- Background:
--   The 2026-09-13 audit called out that administrative fields on
--   public.profiles (is_platform_admin, workshop_role) can be set by
--   an authenticated user if those columns are reachable via
--   PostgREST. RLS only scopes the rows an authenticated user can
--   see / update; it does NOT restrict which columns they may SET
--   inside that UPDATE.
--
--   Two trigger guards already exist:
--     - prevent_platform_admin_self_promotion
--       (20260612000000_admin_platform_flag.sql:23-36) blocks
--       authenticated UPDATEs of is_platform_admin with SQLSTATE
--       42501.
--     - prevent_profile_workshop_id_change
--       (0021_lock_profile_workshop_id.sql:11-23) blocks the
--       authenticated user from moving their own profile to another
--       workshop.
--
--   The W3 audit requires a third guard for workshop_role: an
--   authenticated user starting at 'viewer' must not be able to
--   escalate to 'admin' or 'operational' via PostgREST. This
--   migration (20260913000001_grants_and_workshop_active_protection.sql)
--   extends the existing trigger pair to cover workshop_role.
--
-- This test verifies:
--   1. Both existing trigger functions are still installed.
--   2. The new workshop_role trigger function and trigger are
--      installed.
--   3. An authenticated user cannot escalate is_platform_admin from
--      false to true (existing trigger still fires).
--   4. An authenticated user cannot escalate is_platform_admin from
--      true to false (defense-in-depth — admins must not silently
--      self-demote to cover tracks).
--   5. An authenticated user starting at workshop_role = 'viewer'
--      cannot escalate to 'admin' (new trigger fires).
--   6. An authenticated user at 'viewer' cannot escalate to
--      'operational' (new trigger fires on any non-identity change).
--   7. An authenticated user at 'admin' cannot self-demote to
--      'viewer' (defense-in-depth — same principle as T4).
--   8. An authenticated user CAN still UPDATE safe profile columns
--      (display_name) — the trigger is scoped to admin fields, not
--      a blanket block on UPDATE.
--   9. service_role (auth.uid() IS NULL) CAN escalate is_platform_admin
--      and workshop_role — the manual bootstrap path from
--      20260612000000_admin_platform_flag.sql:42 stays open.
--  10. The trigger rejects even an attempt that ALSO changes safe
--      columns in the same statement — the admin-field guard is
--      not bypassable by piggybacking on a legitimate UPDATE.

begin;

create extension if not exists pgtap with schema extensions;

-- Plan: 21 assertions
select plan(21);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================
create temporary table _profile_admin_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _profile_admin_ids (key, id) values
  ('workshop_a', 'cc000000-0000-0000-0000-0000000000a1'),
  -- Three users in workshop_a at different baseline roles:
  ('user_viewer',     'cc000000-0000-0000-0000-0000000000b1'),
  ('user_operational','cc000000-0000-0000-0000-0000000000b2'),
  ('user_admin',      'cc000000-0000-0000-0000-0000000000b3'),
  -- One user whose is_platform_admin was bootstrapped to true so we
  -- can prove the trigger also blocks self-demotion.
  ('user_platform',   'cc000000-0000-0000-0000-0000000000b4');

grant select on _profile_admin_ids to authenticated, service_role;

-- Seed workshop (service_role setup — see W3 migration for the GRANT).
set local role service_role;
insert into public.workshops (id, name) values
  ((select id from _profile_admin_ids where key = 'workshop_a'),
   'Profile Admin Test Workshop A');
reset role;

-- Seed auth.users (postgres role inserts — auth schema grants).
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   (select id from _profile_admin_ids where key = 'user_viewer'),
   'authenticated', 'authenticated', 'profile-admin-viewer@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _profile_admin_ids where key = 'user_operational'),
   'authenticated', 'authenticated', 'profile-admin-operational@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _profile_admin_ids where key = 'user_admin'),
   'authenticated', 'authenticated', 'profile-admin-admin@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _profile_admin_ids where key = 'user_platform'),
   'authenticated', 'authenticated', 'profile-admin-platform@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Assign profiles with baseline roles. user_platform has
-- is_platform_admin = true (simulating a bootstrapped super-admin).
update public.profiles
   set workshop_id   = (select id from _profile_admin_ids where key = 'workshop_a'),
       workshop_role = 'viewer'::public.workshop_user_role,
       display_name  = 'Vic Viewer',
       is_platform_admin = false
 where id = (select id from _profile_admin_ids where key = 'user_viewer');

update public.profiles
   set workshop_id   = (select id from _profile_admin_ids where key = 'workshop_a'),
       workshop_role = 'operational'::public.workshop_user_role,
       display_name  = 'Oli Operational',
       is_platform_admin = false
 where id = (select id from _profile_admin_ids where key = 'user_operational');

update public.profiles
   set workshop_id   = (select id from _profile_admin_ids where key = 'workshop_a'),
       workshop_role = 'admin'::public.workshop_user_role,
       display_name  = 'Ada Admin',
       is_platform_admin = false
 where id = (select id from _profile_admin_ids where key = 'user_admin');

-- user_platform starts as a platform admin (the bootstrap pattern
-- from 20260612000000_admin_platform_flag.sql:42). We have to set
-- is_platform_admin = true as service_role because the trigger
-- forbids authenticated self-promotion (defense-in-depth).
set local role service_role;
update public.profiles
   set workshop_id   = (select id from _profile_admin_ids where key = 'workshop_a'),
       workshop_role = 'admin'::public.workshop_user_role,
       display_name  = 'Pat Platform',
       is_platform_admin = true
 where id = (select id from _profile_admin_ids where key = 'user_platform');
reset role;

-- ==========================================================================
-- T1: trigger function + trigger installations
-- ==========================================================================
-- We do not assert existence of prevent_platform_admin_self_promotion
-- in detail (that test was already covered by previous work units).
-- We just spot-check the two functions we expect for the W3 admin-
-- field escalation contract.

-- T1.1: prevent_platform_admin_self_promotion function exists.
select has_function(
  'public', 'prevent_platform_admin_self_promotion',
  array[]::text[],
  'T1.1: prevent_platform_admin_self_promotion() function exists (pre-existing trigger)'
);

-- T1.2: prevent_profile_workshop_id_change function exists.
select has_function(
  'public', 'prevent_profile_workshop_id_change',
  array[]::text[],
  'T1.2: prevent_profile_workshop_id_change() function exists (pre-existing trigger)'
);

-- T1.3: prevent_profile_workshop_role_change function exists (NEW
-- trigger added by W3).
select has_function(
  'public', 'prevent_profile_workshop_role_change',
  array[]::text[],
  'T1.3: prevent_profile_workshop_role_change() function exists (W3 new trigger)'
);

-- T1.4: prevent_profile_workshop_role_change trigger is installed
-- BEFORE UPDATE OF workshop_role on public.profiles.
select has_trigger(
  'public', 'profiles',
  'prevent_profile_workshop_role_change',
  'T1.4: prevent_profile_workshop_role_change trigger is installed on public.profiles'
);

-- ==========================================================================
-- T2: is_platform_admin escalation is rejected (existing trigger)
-- ==========================================================================

-- T2.1: user_viewer (is_platform_admin = false) tries to flip it to
-- true. The existing prevent_platform_admin_self_promotion trigger
-- must reject with SQLSTATE 42501.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_viewer'),
  true);

select throws_ok(
  $$
    update public.profiles
       set is_platform_admin = true
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  '42501',
  'profiles.is_platform_admin cannot be changed by authenticated users',
  'T2.1: viewer cannot self-promote to platform admin (existing prevent_platform_admin_self_promotion trigger fires)'
);

-- T2.2: is_platform_admin remains false after the rejected UPDATE.
select results_eq(
  $$
    select is_platform_admin
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  array[false],
  'T2.2: is_platform_admin remains false after the rejected promotion'
);

-- T2.3: user_platform (is_platform_admin = true) tries to flip it to
-- false. Defense-in-depth: admins must not silently self-demote. The
-- existing trigger fires on any DISTINCT change, regardless of
-- direction.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_platform'),
  true);

select throws_ok(
  $$
    update public.profiles
       set is_platform_admin = false
     where id = (select id from _profile_admin_ids where key = 'user_platform')
  $$,
  '42501',
  'profiles.is_platform_admin cannot be changed by authenticated users',
  'T2.3: platform admin cannot self-demote (existing trigger fires on any DISTINCT change to is_platform_admin)'
);

-- T2.4: is_platform_admin remains true after the rejected demotion.
select results_eq(
  $$
    select is_platform_admin
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_platform')
  $$,
  array[true],
  'T2.4: is_platform_admin remains true after the rejected self-demotion'
);

-- ==========================================================================
-- T3: workshop_role escalation is rejected (W3 new trigger)
-- ==========================================================================

-- T3.1: user_viewer (workshop_role = 'viewer') tries to escalate to
-- 'admin'. The new prevent_profile_workshop_role_change trigger must
-- reject with SQLSTATE 42501.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_viewer'),
  true);

select throws_ok(
  $$
    update public.profiles
       set workshop_role = 'admin'::public.workshop_user_role
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  '42501',
  'profiles.workshop_role cannot be changed by authenticated users',
  'T3.1: viewer cannot escalate workshop_role to admin (W3 prevent_profile_workshop_role_change trigger fires)'
);

-- T3.2: workshop_role remains 'viewer' after the rejected escalation.
select results_eq(
  $$
    select workshop_role::text
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  array['viewer'::text],
  'T3.2: workshop_role remains viewer after the rejected escalation'
);

-- T3.3: user_viewer tries to escalate to 'operational' (the other
-- privileged role). Same trigger fires — any non-identity change to
-- workshop_role by an authenticated user is rejected.
select throws_ok(
  $$
    update public.profiles
       set workshop_role = 'operational'::public.workshop_user_role
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  '42501',
  'profiles.workshop_role cannot be changed by authenticated users',
  'T3.3: viewer cannot escalate workshop_role to operational (same trigger rejects every privileged role)'
);

-- T3.4: workshop_role remains 'viewer' after the rejected escalation.
select results_eq(
  $$
    select workshop_role::text
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  array['viewer'::text],
  'T3.4: workshop_role remains viewer after the rejected operational escalation'
);

-- T3.5: user_admin (workshop_role = 'admin') tries to self-demote to
-- 'viewer'. Same defense-in-depth principle as T2.3: the trigger
-- fires on any DISTINCT change, including downward.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_admin'),
  true);

select throws_ok(
  $$
    update public.profiles
       set workshop_role = 'viewer'::public.workshop_user_role
     where id = (select id from _profile_admin_ids where key = 'user_admin')
  $$,
  '42501',
  'profiles.workshop_role cannot be changed by authenticated users',
  'T3.5: admin cannot self-demote to viewer (trigger fires on any DISTINCT change to workshop_role)'
);

-- ==========================================================================
-- T4: authenticated user CAN still UPDATE safe profile columns
-- ==========================================================================
-- The trigger is scoped to BEFORE UPDATE OF workshop_role only. The
-- profiles_update_own policy (0005_auth_profiles.sql:36) still
-- permits UPDATE of other columns (display_name) on the user's own
-- row. This proves the trigger is not a blanket block on UPDATE.

-- T4.1: user_operational renames their own display_name.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_operational'),
  true);

select lives_ok(
  $$
    update public.profiles
       set display_name = 'Oli Operational (renamed)'
     where id = (select id from _profile_admin_ids where key = 'user_operational')
  $$,
  'T4.1: authenticated user can rename their own display_name (trigger is scoped to admin fields only)'
);

-- T4.2: the rename persisted.
select results_eq(
  $$
    select display_name
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_operational')
  $$,
  array['Oli Operational (renamed)'::text],
  'T4.2: the rename persisted — profiles_update_own policy still allows non-admin column updates'
);

-- T4.3: a combined UPDATE that touches display_name AND workshop_role
-- is still rejected (the trigger fires on workshop_role even if other
-- columns change in the same statement). This pins the trigger
-- semantics: it is not bypassable by including admin fields in a
-- multi-column SET.
--
-- IMPORTANT: the JWT claim sub must match the WHERE id — the
-- profiles_update_own policy uses USING on auth.uid() = id, so
-- updating a different user's row matches 0 rows at RLS. We use
-- user_operational's own profile here.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _profile_admin_ids where key = 'user_operational'),
  true);

select throws_ok(
  $$
    update public.profiles
       set display_name = 'Should not be applied',
           workshop_role = 'admin'::public.workshop_user_role
     where id = (select id from _profile_admin_ids where key = 'user_operational')
  $$,
  '42501',
  'profiles.workshop_role cannot be changed by authenticated users',
  'T4.3: an UPDATE that touches workshop_role alongside display_name is still rejected (trigger fires regardless of other columns)'
);

-- T4.4: the rejected combined UPDATE left display_name unchanged.
select results_eq(
  $$
    select display_name
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_operational')
  $$,
  array['Oli Operational (renamed)'::text],
  'T4.4: display_name remains Oli Operational (renamed) after the rejected combined UPDATE (BEFORE trigger fires before the row is written)'
);

-- ==========================================================================
-- T5: service_role CAN escalate admin fields (bootstrap path)
-- ==========================================================================
-- auth.uid() IS NULL in service_role sessions. Both trigger functions
-- guard with `auth.uid() IS NOT NULL`, so service_role updates pass
-- through. This is the manual bootstrap path described in
-- 20260612000000_admin_platform_flag.sql:42 (and the analogous path
-- for workshop_role escalation in admin Edge Functions).
--
-- The defense-in-depth triggers read auth.uid() from the GUC
-- `request.jwt.claim.sub`. After running tests as `authenticated`,
-- that GUC is still set even after `reset role` returns the role to
-- postgres — it is transaction-local and survives `reset role`. We
-- must clear the GUC explicitly before switching to service_role so
-- the trigger's auth gate is bypassed (mirrors the pattern used by
-- production_orders_schema.test.sql).

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

-- T5.1: service_role can flip is_platform_admin from false to true.
select lives_ok(
  $$
    update public.profiles
       set is_platform_admin = true
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  'T5.1: service_role can promote is_platform_admin (manual bootstrap path is not blocked)'
);

-- T5.2: the promotion persisted.
select results_eq(
  $$
    select is_platform_admin
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  array[true],
  'T5.2: is_platform_admin promotion persisted (service_role bypasses the trigger guard)'
);

-- T5.3: service_role can escalate workshop_role from viewer to admin.
select lives_ok(
  $$
    update public.profiles
       set workshop_role = 'admin'::public.workshop_user_role
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  'T5.3: service_role can escalate workshop_role from viewer to admin (admin Edge Function path is not blocked)'
);

-- T5.4: the escalation persisted.
select results_eq(
  $$
    select workshop_role::text
      from public.profiles
     where id = (select id from _profile_admin_ids where key = 'user_viewer')
  $$,
  array['admin'::text],
  'T5.4: workshop_role escalation persisted (service_role bypasses the trigger guard)'
);

reset role;

select * from finish();
rollback;
