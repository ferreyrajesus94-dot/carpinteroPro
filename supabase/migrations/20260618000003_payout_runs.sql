-- SDD-12: Create payout_runs table for audit trail of batch payouts.
-- Also adds the FK from referral_commissions.payout_run_id to payout_runs.id.
-- Platform-global table (no workshop_id); consistent with youtubers/referral tables.
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions.
-- Only service_client (service_role) can write.
-- payout_runs intentionally has no workshop_id because it is platform-global data,
-- consistent with SDD-9 precedent (e.g., youtubers, referral tables have no workshop_id).
-- The commissions within a payout may belong to different workshops, so a single
-- workshop_id would be ambiguous; multi-tenant isolation is not relevant here.

CREATE TABLE IF NOT EXISTS public.payout_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_amount     numeric(12,2) NOT NULL,
  commission_count int NOT NULL,
  reference        text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.payout_runs IS 'Platform-global payout run batches. No workshop_id — see design rationale.';
COMMENT ON COLUMN public.payout_runs.id               IS 'Unique identifier for this payout run';
COMMENT ON COLUMN public.payout_runs.created_by       IS 'Admin profile who executed the payout';
COMMENT ON COLUMN public.payout_runs.total_amount     IS 'Sum of commission amounts in this run';
COMMENT ON COLUMN public.payout_runs.commission_count IS 'Number of commissions paid in this run';
COMMENT ON COLUMN public.payout_runs.reference        IS 'External reference (bank transfer ID, etc.)';
COMMENT ON COLUMN public.payout_runs.notes            IS 'Optional admin notes for this payout';
COMMENT ON COLUMN public.payout_runs.created_at       IS 'When this payout run was created';

ALTER TABLE public.payout_runs ENABLE ROW LEVEL SECURITY;

-- Add FK from referral_commissions (column added in migration 20260618000002)
ALTER TABLE public.referral_commissions
  ADD CONSTRAINT referral_commissions_payout_run_id_fkey
    FOREIGN KEY (payout_run_id) REFERENCES public.payout_runs(id) ON DELETE SET NULL;

-- No authenticated policies — service_role bypass only via admin Edge Functions.

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_columns_found bigint;
  v_fk_count_payout_runs bigint;
  v_fk_commissions_run bigint;
BEGIN
  -- RLS enabled on payout_runs
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.payout_runs'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on payout_runs';
  END IF;

  -- Verify all essential columns exist in payout_runs
  SELECT COUNT(*) INTO v_columns_found
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'payout_runs'
    AND column_name IN ('id', 'created_by', 'total_amount', 'commission_count', 'reference', 'notes', 'created_at');
  IF v_columns_found < 7 THEN
    RAISE EXCEPTION 'Assertion failed: expected 7 columns in payout_runs, found %', v_columns_found;
  END IF;

  -- FK on payout_runs (to profiles)
  SELECT COUNT(*) INTO v_fk_count_payout_runs
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.payout_runs'::regclass;
  IF v_fk_count_payout_runs < 1 THEN
    RAISE EXCEPTION 'Assertion failed: payout_runs has % FKs, expected at least 1 (profiles)', v_fk_count_payout_runs;
  END IF;

  -- FK on referral_commissions pointing to payout_runs
  SELECT COUNT(*) INTO v_fk_commissions_run
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.referral_commissions'::regclass
    AND confrelid = 'public.payout_runs'::regclass;
  IF v_fk_commissions_run = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions missing FK to payout_runs';
  END IF;
END;
$$;
