-- SDD-11: Per-workshop referral attribution (one row per workshop, ever).
-- workshop_id is PRIMARY KEY — a workshop can only be attributed once.
-- Self-referral is blocked at the handle_new_user trigger layer (not in this migration).
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions.

CREATE TABLE public.workshop_referrals (
  workshop_id      uuid PRIMARY KEY REFERENCES public.workshops(id) ON DELETE CASCADE,
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  youtuber_id      uuid NOT NULL REFERENCES public.youtubers(id),
  attributed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_referrals ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — service_role bypass only via admin Edge Functions.

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_policy_count bigint;
  v_pk_columns text[];
  v_fk_count bigint;
BEGIN
  -- RLS enabled
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.workshop_referrals'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on workshop_referrals';
  END IF;

  -- No authenticated policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'workshop_referrals'
    AND pol.polroles @> (SELECT array_agg(oid) FROM pg_roles WHERE rolname = 'authenticated');
  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: workshop_referrals has % authenticated policies (must be 0)', v_policy_count;
  END IF;

  -- PK on workshop_id
  SELECT array_agg(att.attname ORDER BY att.attnum) INTO v_pk_columns
  FROM pg_index i
  JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'public.workshop_referrals'::regclass
    AND i.indisprimary;
  IF v_pk_columns IS DISTINCT FROM '{workshop_id}' THEN
    RAISE EXCEPTION 'Assertion failed: workshop_referrals PK columns are %, expected {workshop_id}', v_pk_columns;
  END IF;

  -- FK count (workshops, referral_codes, youtubers)
  SELECT COUNT(*) INTO v_fk_count
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.workshop_referrals'::regclass;
  IF v_fk_count < 3 THEN
    RAISE EXCEPTION 'Assertion failed: workshop_referrals has % FKs, expected at least 3', v_fk_count;
  END IF;
END;
$$;
