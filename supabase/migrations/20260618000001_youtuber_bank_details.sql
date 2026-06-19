-- SDD-12: Add structured bank detail columns to youtubers.
-- Keeps legacy payout_method column (deprecated, not dropped).
-- RLS remains enabled with no authenticated policies; accessed only via admin Edge Functions.

ALTER TABLE public.youtubers
  ADD COLUMN payout_cbu          text,
  ADD COLUMN payout_cvu          text,
  ADD COLUMN payout_alias        text,
  ADD COLUMN payout_bank_name    text,
  ADD COLUMN payout_holder_name  text,
  ADD COLUMN payout_holder_cuit  text;

COMMENT ON COLUMN public.youtubers.payout_cbu          IS 'CBU – 22 dígitos (Clave Bancaria Uniforme)';
COMMENT ON COLUMN public.youtubers.payout_cvu          IS 'CVU – 23 dígitos (Clave Virtual Uniforme)';
COMMENT ON COLUMN public.youtubers.payout_alias        IS 'Alias CBU/CVU';
COMMENT ON COLUMN public.youtubers.payout_bank_name    IS 'Nombre del banco o entidad financiera';
COMMENT ON COLUMN public.youtubers.payout_holder_name  IS 'Nombre del titular de la cuenta';
COMMENT ON COLUMN public.youtubers.payout_holder_cuit  IS 'CUIT del titular (formato XX-XXXXXXXX-X)';

-- payout_method is kept for legacy compatibility but not used by the payout workflow

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_columns_found bigint;
BEGIN
  -- RLS still enabled (was enabled by the original youtubers migration)
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.youtubers'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on youtubers';
  END IF;

  -- Verify all 6 new columns exist
  SELECT COUNT(*) INTO v_columns_found
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'youtubers'
    AND column_name IN (
      'payout_cbu', 'payout_cvu', 'payout_alias',
      'payout_bank_name', 'payout_holder_name', 'payout_holder_cuit'
    );
  IF v_columns_found < 6 THEN
    RAISE EXCEPTION 'Assertion failed: expected 6 bank detail columns in youtubers, found %', v_columns_found;
  END IF;
END;
$$;
