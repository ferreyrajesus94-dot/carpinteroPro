-- SDD-11: Referral codes linked to YouTubers.
-- Each code has a discount percentage (for the subscribing workshop's first period)
-- and a commission percentage (for the YouTuber's payout).
-- Code is unique case-insensitively via lower(code) unique index.
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions.

CREATE TABLE public.referral_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtuber_id    uuid NOT NULL REFERENCES public.youtubers(id) ON DELETE CASCADE,
  code           text NOT NULL,
  discount_pct   numeric(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  commission_pct numeric(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique code enforcement
CREATE UNIQUE INDEX referral_codes_code_lower_idx
  ON public.referral_codes (LOWER(code));

CREATE INDEX referral_codes_youtuber_id_idx
  ON public.referral_codes(youtuber_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — service_role bypass only via admin Edge Functions.

CREATE TRIGGER referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_policy_count bigint;
  v_unique_idx_count bigint;
  v_youtuber_fk boolean;
  v_pct_check_count bigint;
BEGIN
  -- RLS enabled
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.referral_codes'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on referral_codes';
  END IF;

  -- No authenticated policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'referral_codes'
    AND pol.polroles @> (SELECT array_agg(oid) FROM pg_roles WHERE rolname = 'authenticated');
  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_codes has % authenticated policies (must be 0)', v_policy_count;
  END IF;

  -- Unique lower(code) index
  SELECT COUNT(*) INTO v_unique_idx_count
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'referral_codes'
    AND i.indisunique
    AND pg_get_indexdef(i.indexrelid) ILIKE '%lower(code)%';
  IF v_unique_idx_count = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_codes missing unique lower(code) index';
  END IF;

  -- FK to youtubers exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_codes_youtuber_id_fkey'
      AND contype = 'f'
      AND connamespace = 'public'::regnamespace
  ) INTO v_youtuber_fk;
  IF NOT v_youtuber_fk THEN
    RAISE EXCEPTION 'Assertion failed: referral_codes missing FK to youtubers';
  END IF;

  -- Percentage CHECK constraints exist (discount_pct <= 100, commission_pct <= 100)
  SELECT COUNT(*) INTO v_pct_check_count
  FROM pg_constraint
  WHERE contype = 'c'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.referral_codes'::regclass
    AND (pg_get_constraintdef(oid) ILIKE '%discount_pct%' OR pg_get_constraintdef(oid) ILIKE '%commission_pct%');
  IF v_pct_check_count < 2 THEN
    RAISE EXCEPTION 'Assertion failed: referral_codes missing pct CHECK constraints (found %)', v_pct_check_count;
  END IF;
END;
$$;
