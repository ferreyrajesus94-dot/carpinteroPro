-- SDD-12: Add payout status tracking to referral_commissions.
-- Status is mutable metadata; ledger amounts remain immutable.
-- Partial index on status = 'pending' for fast pending-commission queries.
-- payout_run_id FK is added in migration 20260618000003 (payout_runs table).
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions.

ALTER TABLE public.referral_commissions
  ADD COLUMN status            text NOT NULL DEFAULT 'pending',
  ADD COLUMN paid_at           timestamptz,
  ADD COLUMN payout_reference  text,
  ADD COLUMN payout_run_id     uuid;

ALTER TABLE public.referral_commissions
  ADD CONSTRAINT referral_commissions_status_check
    CHECK (status IN ('pending', 'paid', 'cancelled'));

CREATE INDEX referral_commissions_pending_idx
  ON public.referral_commissions(status)
  WHERE status = 'pending';

COMMENT ON COLUMN public.referral_commissions.status           IS 'pending | paid | cancelled';
COMMENT ON COLUMN public.referral_commissions.paid_at          IS 'Timestamp when commission was marked as paid';
COMMENT ON COLUMN public.referral_commissions.payout_reference IS 'Bank transfer reference or external payment ID';
COMMENT ON COLUMN public.referral_commissions.payout_run_id    IS 'Reference to the payout run that includes this commission (FK added in next migration)';

-- No RLS changes needed — table already has RLS enabled and no policies.

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_check_exists bigint;
  v_idx_exists bigint;
  v_columns_found bigint;
BEGIN
  -- RLS still enabled
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.referral_commissions'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on referral_commissions';
  END IF;

  -- Check constraint exists
  SELECT COUNT(*) INTO v_check_exists
  FROM pg_constraint
  WHERE contype = 'c'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.referral_commissions'::regclass
    AND conname = 'referral_commissions_status_check';
  IF v_check_exists = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions_status_check constraint not found';
  END IF;

  -- Partial index on status = 'pending'
  SELECT COUNT(*) INTO v_idx_exists
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relname = 'referral_commissions'
    AND pg_get_indexdef(i.indexrelid) ILIKE '%status%pending%';
  IF v_idx_exists = 0 THEN
    RAISE EXCEPTION 'Assertion failed: missing partial index on referral_commissions(status) WHERE status = pending';
  END IF;

  -- Verify all 4 new columns exist (FK constraint added in next migration)
  SELECT COUNT(*) INTO v_columns_found
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'referral_commissions'
    AND column_name IN ('status', 'paid_at', 'payout_reference', 'payout_run_id');
  IF v_columns_found < 4 THEN
    RAISE EXCEPTION 'Assertion failed: expected 4 new columns in referral_commissions, found %', v_columns_found;
  END IF;
END;
$$;
