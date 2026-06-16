-- pgTAP test: handle_new_user trigger attribution behavior
-- Covers: valid code, case-insensitive match, unknown code skip,
--         inactive code skip, self-referral block, missing key no-op.
--
-- Each test inserts into auth.users directly. The trigger fires,
-- creates workshop+profile, and (with the upcoming change) optionally
-- inserts into workshop_referrals.
--
-- Everything runs in a single transaction that rolls back.

begin;

create extension if not exists pgtap with schema extensions;

-- Plan: 10 assertions
select plan(9);

/********************************************************************
 * Setup: YouTubers and referral codes
 ********************************************************************/
INSERT INTO public.youtubers (id, display_name, contact_email)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'YT Promo',   'promo@example.com'),
  ('80000000-0000-0000-0000-000000000002', 'YT Inactive', 'inactive@example.com');

INSERT INTO public.referral_codes (id, youtuber_id, code, discount_pct, commission_pct, is_active)
VALUES
  ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'PROMO20',   20.00, 15.00, true),
  ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'INACTIVE10', 10.00, 10.00, false);

-- Create a placeholder workshop so we can verify FK references if needed
INSERT INTO public.workshops (id, name)
VALUES ('00000000-0000-0000-0000-000000000099', 'Placeholder')
ON CONFLICT (id) DO NOTHING;

/********************************************************************
 * Helper: count workshop_referrals for a given auth user id
 ********************************************************************/
create or replace function _ref_count_for(uid uuid)
returns bigint
language sql
as $$
  select count(*)::bigint
  from public.workshop_referrals wr
  join public.profiles p on p.workshop_id = wr.workshop_id
  where p.id = uid;
$$;

/********************************************************************
 * Test 1 — Valid code stamps attribution
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000001', 'new@workshop.com',
        '{"referral_code": "PROMO20"}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'T1: valid code creates one workshop_referrals row'
);

-- Verify the code resolves correctly
select is(
  (select rc.code
   from public.workshop_referrals wr
   join public.profiles p on p.workshop_id = wr.workshop_id
   join public.referral_codes rc on rc.id = wr.referral_code_id
   where p.id = 'a0000000-0000-0000-0000-000000000001'),
  'PROMO20',
  'T1: referral_code_id points to PROMO20'
);

/********************************************************************
 * Test 2 — Case-insensitive match (input "promo20" vs stored "PROMO20")
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000002', 'case@workshop.com',
        '{"referral_code": "promo20"}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'T2: case-insensitive match creates workshop_referrals'
);

/********************************************************************
 * Test 3 — Unknown code silently ignored
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000003', 'unknown@workshop.com',
        '{"referral_code": "INVALIDX"}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000003'),
  0::bigint,
  'T3: unknown code skips workshop_referrals'
);

/********************************************************************
 * Test 4 — Inactive code silently ignored
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000004', 'inactive@workshop.com',
        '{"referral_code": "INACTIVE10"}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000004'),
  0::bigint,
  'T4: inactive code skips workshop_referrals'
);

/********************************************************************
 * Test 5 — Self-referral blocked (email matches youtuber.contact_email)
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000005', 'promo@example.com',
        '{"referral_code": "PROMO20"}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000005'),
  0::bigint,
  'T5: self-referral blocks workshop_referrals'
);

/********************************************************************
 * Test 6 — Missing referral_code key is no-op
 ********************************************************************/
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0000000-0000-0000-0000-000000000006', 'noref@workshop.com',
        '{}');

select is(
  _ref_count_for('a0000000-0000-0000-0000-000000000006'),
  0::bigint,
  'T6: no referral_code key skips workshop_referrals'
);

/********************************************************************
 * Test 7-8 — Profile + workshop always created (regardless of referral)
 ********************************************************************/
select is(
  (select count(*) from public.profiles
   where id in ('a0000000-0000-0000-0000-000000000003',
                'a0000000-0000-0000-0000-000000000004',
                'a0000000-0000-0000-0000-000000000005',
                'a0000000-0000-0000-0000-000000000006')),
  4::bigint,
  'T7: profiles created for all users regardless of referral outcome'
);

select is(
  (select count(*) from public.workshops
   where id in (
     select distinct workshop_id from public.profiles
     where id in ('a0000000-0000-0000-0000-000000000001',
                  'a0000000-0000-0000-0000-000000000002',
                  'a0000000-0000-0000-0000-000000000003',
                  'a0000000-0000-0000-0000-000000000004',
                  'a0000000-0000-0000-0000-000000000005',
                  'a0000000-0000-0000-0000-000000000006')
   )),
  6::bigint,
  'T8: workshops created for all 6 test users'
);

/********************************************************************
 * Cleanup
 ********************************************************************/
select * from finish();
rollback;
