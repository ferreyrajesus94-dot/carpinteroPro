-- SDD-11: Add referral audit columns to subscriptions table.
-- first_period_discount_pct: the percentage discount applied to the first preapproval (audit after first period).
-- referred_by_referral_code_id: which code referred this workshop (nullable — unreferred workshops stay null).
-- Both columns are NULL on existing rows (ALTER TABLE default).

ALTER TABLE public.subscriptions
  ADD COLUMN first_period_discount_pct numeric(5,2) NULL,
  ADD COLUMN referred_by_referral_code_id uuid NULL REFERENCES public.referral_codes(id);

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_pct_nullable text;
  v_code_nullable text;
  v_fk_exists boolean;
BEGIN
  -- first_period_discount_pct exists and is nullable
  SELECT is_nullable INTO v_pct_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'subscriptions'
    AND column_name = 'first_period_discount_pct';
  IF v_pct_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'Assertion failed: subscriptions.first_period_discount_pct is not nullable';
  END IF;

  -- referred_by_referral_code_id exists and is nullable
  SELECT is_nullable INTO v_code_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'subscriptions'
    AND column_name = 'referred_by_referral_code_id';
  IF v_code_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'Assertion failed: subscriptions.referred_by_referral_code_id is not nullable';
  END IF;

  -- FK exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_referred_by_referral_code_id_fkey'
      AND contype = 'f'
      AND connamespace = 'public'::regnamespace
  ) INTO v_fk_exists;
  IF NOT v_fk_exists THEN
    RAISE EXCEPTION 'Assertion failed: subscriptions missing FK to referral_codes for referred_by_referral_code_id';
  END IF;
END;
$$;
