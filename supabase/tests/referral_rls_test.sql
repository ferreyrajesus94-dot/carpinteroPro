begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

/********************************************************************
 * Test data helpers
 ********************************************************************/
create temporary table _ref_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into _ref_test_ids (key, id) values
  ('youtuber_a',  '80000000-0000-0000-0000-000000000001'),
  ('youtuber_b',  '80000000-0000-0000-0000-000000000002'),
  ('code_a',      '90000000-0000-0000-0000-000000000001'),
  ('code_b',      '90000000-0000-0000-0000-000000000002'),
  ('workshop_a',  '10000000-0000-0000-0000-000000000001'),
  ('workshop_b',  '10000000-0000-0000-0000-000000000002'),
  ('user_a',      '20000000-0000-0000-0000-000000000001'),
  ('sub_a',       'a0000000-0000-0000-0000-000000000001'),
  ('commission_a','b0000000-0000-0000-0000-000000000001'),
  ('commission_b','b0000000-0000-0000-0000-000000000002');

/********************************************************************
 * 1. Table existence
 ********************************************************************/
select has_table('public', 'youtubers', 'youtubers table exists');
select has_table('public', 'referral_codes', 'referral_codes table exists');
select has_table('public', 'workshop_referrals', 'workshop_referrals table exists');
select has_table('public', 'referral_commissions', 'referral_commissions table exists');

/********************************************************************
 * 2. Column checks — youtubers
 ********************************************************************/
select has_column('public', 'youtubers', 'id', 'youtubers has id');
select has_column('public', 'youtubers', 'display_name', 'youtubers has display_name');
select col_not_null('public', 'youtubers', 'display_name', 'youtubers.display_name is NOT NULL');
select col_is_pk('public', 'youtubers', 'id', 'youtubers.id is PK');
select col_not_null('public', 'youtubers', 'is_active', 'youtubers.is_active is NOT NULL');
select col_has_default('public', 'youtubers', 'is_active', 'youtubers.is_active has default');

/********************************************************************
 * 3. Column checks — referral_codes
 ********************************************************************/
select has_column('public', 'referral_codes', 'code', 'referral_codes has code');
select col_not_null('public', 'referral_codes', 'code', 'referral_codes.code is NOT NULL');
select col_not_null('public', 'referral_codes', 'discount_pct', 'referral_codes.discount_pct is NOT NULL');
select col_not_null('public', 'referral_codes', 'commission_pct', 'referral_codes.commission_pct is NOT NULL');

/********************************************************************
 * 4. Column checks — workshop_referrals
 ********************************************************************/
select has_column('public', 'workshop_referrals', 'workshop_id', 'workshop_referrals has workshop_id');
select col_is_pk('public', 'workshop_referrals', 'workshop_id', 'workshop_referrals.workshop_id is PK');
select col_not_null('public', 'workshop_referrals', 'referral_code_id', 'workshop_referrals.referral_code_id NOT NULL');
select col_not_null('public', 'workshop_referrals', 'youtuber_id', 'workshop_referrals.youtuber_id NOT NULL');

/********************************************************************
 * 5. Column checks — referral_commissions
 ********************************************************************/
select has_column('public', 'referral_commissions', 'provider_payment_id', 'referral_commissions has provider_payment_id');
select col_not_null('public', 'referral_commissions', 'provider_payment_id', 'referral_commissions.provider_payment_id NOT NULL');
select col_not_null('public', 'referral_commissions', 'payment_amount', 'referral_commissions.payment_amount NOT NULL');
select col_not_null('public', 'referral_commissions', 'commission_amount', 'referral_commissions.commission_amount NOT NULL');

/********************************************************************
 * 6. Subscription columns
 ********************************************************************/
select has_column('public', 'subscriptions', 'first_period_discount_pct', 'subscriptions.first_period_discount_pct exists');
select has_column('public', 'subscriptions', 'referred_by_referral_code_id', 'subscriptions.referred_by_referral_code_id exists');

/********************************************************************
 * 7. RLS enabled on all 4 tables (no authenticated policies)
 ********************************************************************/
select is(
  (select relrowsecurity from pg_class where oid = 'public.youtubers'::regclass),
  true,
  'youtubers has RLS enabled'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.referral_codes'::regclass),
  true,
  'referral_codes has RLS enabled'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.workshop_referrals'::regclass),
  true,
  'workshop_referrals has RLS enabled'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.referral_commissions'::regclass),
  true,
  'referral_commissions has RLS enabled'
);

/********************************************************************
 * 8. No authenticated policies on referral tables
 ********************************************************************/
select is(
  (select count(*)::bigint from pg_policy pol
   join pg_class cls on cls.oid = pol.polrelid
   where cls.relname in ('youtubers', 'referral_codes', 'workshop_referrals', 'referral_commissions')
      and pol.polroles @> (select array_agg(oid) from pg_roles where rolname = 'authenticated')),
  0::bigint,
  'no authenticated policies on referral tables'
);

/********************************************************************
 * 9. Unique constraints
 ********************************************************************/
select is(
  (select count(*)::bigint from pg_index i
   join pg_class c on c.oid = i.indrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'referral_codes'
     and i.indisunique
     and pg_get_indexdef(i.indexrelid) ILIKE '%lower(code)%'),
  1::bigint,
  'referral_codes has unique lower(code) index'
);

select is(
  (select count(*)::bigint from pg_index i
   join pg_class c on c.oid = i.indrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'referral_commissions'
     and i.indisunique
     and pg_get_indexdef(i.indexrelid) ILIKE '%provider_payment_id%'),
  1::bigint,
  'referral_commissions has unique provider_payment_id index'
);

/********************************************************************
 * 10. Foreign keys
 ********************************************************************/
select is(
  (select count(*) from pg_constraint
   where contype = 'f'
     and connamespace = 'public'::regnamespace
     and conrelid::regclass::text in ('referral_codes', 'workshop_referrals', 'referral_commissions')
     and conname::text in (
       'referral_codes_youtuber_id_fkey',
       'workshop_referrals_referral_code_id_fkey',
       'workshop_referrals_workshop_id_fkey',
       'workshop_referrals_youtuber_id_fkey',
       'referral_commissions_referral_code_id_fkey',
       'referral_commissions_subscription_id_fkey',
       'referral_commissions_workshop_id_fkey',
       'referral_commissions_youtuber_id_fkey'
     )
  )::bigint,
  8::bigint,
  'all expected foreign keys exist on referral tables'
);

select * from finish();
rollback;
