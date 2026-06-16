-- SDD-11: Commission ledger for YouTuber payouts.
-- Immutable row per approved authorized payment. provider_payment_id is unique for webhook idempotency.
-- Snapshot of payment_amount, commission_pct, commission_amount at time of event (not derived at read time).
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions.

CREATE TABLE public.referral_commissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id        uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  youtuber_id        uuid NOT NULL REFERENCES public.youtubers(id) ON DELETE RESTRICT,
  referral_code_id   uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  subscription_id    uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider_payment_id text NOT NULL,
  payment_amount     numeric(12,2) NOT NULL,
  commission_pct     numeric(5,2) NOT NULL,
  commission_amount  numeric(12,2) NOT NULL,
  currency           text NOT NULL DEFAULT 'ARS',
  occurred_at        timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Unique for webhook idempotency (23505 catch in webhook)
CREATE UNIQUE INDEX referral_commissions_provider_payment_id_idx
  ON public.referral_commissions(provider_payment_id);

-- Query indices for admin reporting
CREATE INDEX referral_commissions_youtuber_id_idx
  ON public.referral_commissions(youtuber_id);

CREATE INDEX referral_commissions_workshop_id_idx
  ON public.referral_commissions(workshop_id);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — service_role bypass only via admin Edge Functions.

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_policy_count bigint;
  v_unique_count bigint;
  v_idx_youtuber bigint;
  v_idx_workshop bigint;
  v_fk_count bigint;
BEGIN
  -- RLS enabled
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.referral_commissions'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on referral_commissions';
  END IF;

  -- No authenticated policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'referral_commissions'
    AND pol.polroles @> (SELECT array_agg(oid) FROM pg_roles WHERE rolname = 'authenticated');
  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions has % authenticated policies (must be 0)', v_policy_count;
  END IF;

  -- Unique provider_payment_id index
  SELECT COUNT(*) INTO v_unique_count
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'referral_commissions'
    AND i.indisunique
    AND pg_get_indexdef(i.indexrelid) ILIKE '%provider_payment_id%';
  IF v_unique_count = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions missing unique provider_payment_id index';
  END IF;

  -- Index on youtuber_id
  SELECT COUNT(*) INTO v_idx_youtuber
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relname = 'referral_commissions'
    AND pg_get_indexdef(i.indexrelid) ILIKE '%youtuber_id%';
  IF v_idx_youtuber = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions missing youtuber_id index';
  END IF;

  -- Index on workshop_id
  SELECT COUNT(*) INTO v_idx_workshop
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relname = 'referral_commissions'
    AND pg_get_indexdef(i.indexrelid) ILIKE '%workshop_id%';
  IF v_idx_workshop = 0 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions missing workshop_id index';
  END IF;

  -- FK count (workshops, youtubers, referral_codes, subscriptions)
  SELECT COUNT(*) INTO v_fk_count
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND conrelid = 'public.referral_commissions'::regclass;
  IF v_fk_count < 4 THEN
    RAISE EXCEPTION 'Assertion failed: referral_commissions has % FKs, expected at least 4', v_fk_count;
  END IF;
END;
$$;
