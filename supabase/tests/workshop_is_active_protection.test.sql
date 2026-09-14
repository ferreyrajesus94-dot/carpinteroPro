-- Test: workshops.is_active is protected from authenticated self-mutation
--
-- Satisfies W3 acceptance criterion AC-3 from
-- docs/operations/production-readiness-audit-2026-09-13.md.
--
-- Background:
--   The 2026-09-13 audit identified that workshops.is_active (added by
--   20260613000000_workshop_active_flag.sql) is not protected by RLS
--   or a trigger. The workshops_update_own policy
--   (0020_tenant_rls_security.sql:31) scopes UPDATE to the caller's
--   workshop via USING/WITH CHECK on `id = get_current_workshop_id()`,
--   but does not restrict which columns may be SET. Without a guard,
--   a workshop member can self-reactivate via PostgREST.
--
--   The 20260913000001_grants_and_workshop_active_protection.sql
--   migration installs the prevent_workshop_self_reactivation trigger,
--   which mirrors the pattern of
--   prevent_platform_admin_self_promotion
--   (20260612000000_admin_platform_flag.sql:23-36). The trigger fires
--   on BEFORE UPDATE OF is_active and rejects with SQLSTATE 42501
--   when auth.uid() IS NOT NULL. service_role (auth.uid() IS NULL)
--   keeps working so the admin-toggle-workshop EF is not broken.
--
-- This test verifies:
--   1. The trigger function and trigger are installed in pg_catalog.
--   2. An authenticated workshop member attempting to flip is_active
--      (either direction) is rejected with SQLSTATE 42501.
--   3. The workshops_update_own policy still allows UPDATE of OTHER
--      columns (e.g., name) for the same authenticated user. This
--      proves the trigger is scoped to is_active, not a blanket
--      block on UPDATE.
--   4. Service role (auth.uid() IS NULL) can flip is_active — the
--      admin-toggle-workshop EF path stays open.
--   5. A user without a profile (so get_current_workshop_id() returns
--      NULL) cannot exploit the trigger to flip is_active either.

begin;

create extension if not exists pgtap with schema extensions;

-- Plan: 13 assertions
select plan(13);

-- ==========================================================================
-- Shared test scaffolding
-- ==========================================================================
create temporary table _workshop_active_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _workshop_active_ids (key, id) values
  -- Workshops: workshop_a starts active, workshop_b starts active.
  -- The test will deactivate workshop_a via service_role to prove
  -- the authenticated path cannot reactivate it.
  ('workshop_a', '77000000-0000-0000-0000-0000000000a1'),
  ('workshop_b', '77000000-0000-0000-0000-0000000000b2'),
  -- Users
  ('user_a',     '88000000-0000-0000-0000-0000000000a1'),
  ('user_b',     '88000000-0000-0000-0000-0000000000b2'),
  -- A user that exists in auth.users but has no profile row, so
  -- get_current_workshop_id() returns NULL for them.
  ('user_no_profile', '88000000-0000-0000-0000-000000000099');

grant select on _workshop_active_ids to authenticated, service_role;

-- Seed workshops (service_role setup — bypasses RLS by virtue of
-- BYPASSRLS; the GRANTs added in the W3 migration also allow it).
set local role service_role;
insert into public.workshops (id, name, is_active) values
  ((select id from _workshop_active_ids where key = 'workshop_a'),
   'Workshop Active Test A',
   true),
  ((select id from _workshop_active_ids where key = 'workshop_b'),
   'Workshop Active Test B',
   true);
reset role;

-- Seed auth.users (the test connection runs as postgres/BYPASSRLS, so
-- no service_role switch is needed for the auth schema). We seed the
-- bare minimum: id and email. raw_app_meta_data / raw_user_meta_data
-- are required NOT NULL by auth schema in some Supabase versions, so
-- we provide empty jsonb.
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   (select id from _workshop_active_ids where key = 'user_a'),
   'authenticated', 'authenticated', 'workshop-active-a@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _workshop_active_ids where key = 'user_b'),
   'authenticated', 'authenticated', 'workshop-active-b@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   (select id from _workshop_active_ids where key = 'user_no_profile'),
   'authenticated', 'authenticated', 'workshop-active-noprofile@example.com',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Attach profiles for users A and B; deliberately leave user_no_profile
-- without a profile row.
update public.profiles
   set workshop_id = (select id from _workshop_active_ids where key = 'workshop_a'),
       display_name = 'Workshop Active User A'
 where id = (select id from _workshop_active_ids where key = 'user_a');

update public.profiles
   set workshop_id = (select id from _workshop_active_ids where key = 'workshop_b'),
       display_name = 'Workshop Active User B'
 where id = (select id from _workshop_active_ids where key = 'user_b');

-- ==========================================================================
-- T1: trigger function + trigger are installed
-- ==========================================================================

-- T1.1: prevent_workshop_self_reactivation function exists
select has_function(
  'public', 'prevent_workshop_self_reactivation',
  array[]::text[],
  'T1.1: prevent_workshop_self_reactivation() function exists'
);

-- T1.2: the trigger fires BEFORE UPDATE OF is_active on public.workshops
select has_trigger(
  'public', 'workshops',
  'prevent_workshop_self_reactivation',
  'T1.2: prevent_workshop_self_reactivation trigger is installed on public.workshops'
);

-- ==========================================================================
-- T2: authenticated user CANNOT flip is_active (either direction)
-- ==========================================================================

-- T2.1: authenticated user_a trying to set is_active = false on their
-- own workshop is rejected with SQLSTATE 42501.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _workshop_active_ids where key = 'user_a'),
  true);

select throws_ok(
  $$
    update public.workshops
       set is_active = false
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  '42501',
  'workshops.is_active cannot be changed by authenticated users; use the admin-toggle-workshop edge function',
  'T2.1: authenticated user_a cannot deactivate their own workshop (is_active = false rejected with 42501)'
);

-- T2.2: same setup — is_active is still true after the rejected UPDATE
select results_eq(
  $$
    select is_active
      from public.workshops
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  array[true],
  'T2.2: is_active remains true after the rejected UPDATE (trigger fires BEFORE the row is written)'
);

-- T2.3: service_role deactivates workshop_a, then authenticated user_a
-- tries to reactivate. The trigger must reject the reactivation with
-- SQLSTATE 42501 even though the column is currently false.
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
update public.workshops
   set is_active = false
 where id = (select id from _workshop_active_ids where key = 'workshop_a');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _workshop_active_ids where key = 'user_a'),
  true);

select throws_ok(
  $$
    update public.workshops
       set is_active = true
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  '42501',
  'workshops.is_active cannot be changed by authenticated users; use the admin-toggle-workshop edge function',
  'T2.3: authenticated user_a cannot reactivate a workshop that admin has deactivated (is_active = true rejected with 42501)'
);

-- T2.4: the rejected reactivation leaves is_active = false. The
-- authenticated UPDATE attempted to flip the flag; the trigger must
-- have raised BEFORE the row changed.
select results_eq(
  $$
    select is_active
      from public.workshops
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  array[false],
  'T2.4: is_active remains false after the rejected reactivation (service_role deactivation persists)'
);

-- ==========================================================================
-- T3: authenticated user CAN still UPDATE other columns
-- ==========================================================================
-- The trigger is scoped to BEFORE UPDATE OF is_active only. The
-- workshops_update_own policy still permits UPDATE of other columns
-- (name, for example). This proves the trigger is not a blanket block
-- on UPDATE — the existing self-service workshop renaming flow keeps
-- working.
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
update public.workshops
   set is_active = true
 where id = (select id from _workshop_active_ids where key = 'workshop_a');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _workshop_active_ids where key = 'user_a'),
  true);

-- T3.1: lives_ok — authenticated user_a updates a non-is_active
-- column (name) on their own workshop. The trigger does not fire
-- because is_active is not in the SET clause, so the UPDATE succeeds.
select lives_ok(
  $$
    update public.workshops
       set name = 'Workshop Active Test A (renamed)'
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  'T3.1: authenticated user_a can rename their own workshop (name column) — trigger is scoped to is_active only'
);

-- T3.2: the rename actually persisted (workshops_update_own WITH CHECK
-- passes for non-is_active columns).
select results_eq(
  $$
    select name
      from public.workshops
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  array['Workshop Active Test A (renamed)'::text],
  'T3.2: the rename persisted — workshops_update_own policy allows non-is_active column updates'
);

-- T3.3: a combined UPDATE that touches is_active AND name is still
-- rejected (the trigger fires on is_active even if other columns
-- change in the same statement). This pins the trigger semantics:
-- it is not bypassable by including is_active in a multi-column SET.
select throws_ok(
  $$
    update public.workshops
       set name = 'Should not be applied',
           is_active = false
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  '42501',
  'workshops.is_active cannot be changed by authenticated users; use the admin-toggle-workshop edge function',
  'T3.3: an UPDATE that touches is_active alongside name is still rejected (trigger fires regardless of other columns)'
);

-- ==========================================================================
-- T4: service_role CAN flip is_active (admin-toggle-workshop path)
-- ==========================================================================
-- auth.uid() IS NULL in service_role sessions. The trigger's
-- `auth.uid() IS NOT NULL` guard lets the change through. This is
-- the operational contract: the admin Edge Function keeps working.
--
-- NOTE: Postgres reads auth.uid() from the GUC
-- `request.jwt.claim.sub`. After running tests as `authenticated`,
-- that GUC is still set even after `reset role` returns the role to
-- postgres — it is transaction-local and survives `reset role`. We
-- must clear the GUC explicitly before switching to service_role so
-- the trigger's auth gate is bypassed (mirrors the pattern used by
-- production_orders_schema.test.sql).
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

-- T4.1: service_role flips is_active = false successfully.
select lives_ok(
  $$
    update public.workshops
       set is_active = false
     where id = (select id from _workshop_active_ids where key = 'workshop_b')
  $$,
  'T4.1: service_role can flip is_active = false (admin-toggle-workshop EF path is not blocked)'
);

-- T4.2: the change persisted.
select results_eq(
  $$
    select is_active
      from public.workshops
     where id = (select id from _workshop_active_ids where key = 'workshop_b')
  $$,
  array[false],
  'T4.2: service_role deactivation of workshop_b persisted'
);

-- T4.3: service_role can reactivate (flip back to true). This
-- simulates the full lifecycle of the admin Edge Function.
select lives_ok(
  $$
    update public.workshops
       set is_active = true
     where id = (select id from _workshop_active_ids where key = 'workshop_b')
  $$,
  'T4.3: service_role can flip is_active = true (reactivation via admin path)'
);

reset role;

-- ==========================================================================
-- T5: a profile-less authenticated user cannot see / flip is_active
-- ==========================================================================
-- user_no_profile has a row in auth.users but no row in public.profiles,
-- so get_current_workshop_id() returns NULL for them. The RLS policy
-- hides every workshop row from them (workshops_select_own uses
-- id = get_current_workshop_id(), which is NULL != the workshop id).
-- The UPDATE silently matches 0 rows at the RLS layer.
--
-- We only assert the read-denial contract here. The trigger's
-- `auth.uid() IS NOT NULL` guard is independent of profile
-- presence — a future bug that exposes workshop rows to a
-- profile-less authenticated user would still hit the trigger —
-- but exercising that branch deterministically requires dropping
-- the RLS policy, which is out of scope for this isolated test.

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select id::text from _workshop_active_ids where key = 'user_no_profile'),
  true);

-- T5.1: the profile-less user has no row visible (RLS blocks).
select results_eq(
  $$
    select count(*)::bigint
      from public.workshops
     where id = (select id from _workshop_active_ids where key = 'workshop_a')
  $$,
  array[0::bigint],
  'T5.1: a profile-less authenticated user sees 0 workshop rows (RLS hides them via get_current_workshop_id() = NULL)'
);

select * from finish();
rollback;
