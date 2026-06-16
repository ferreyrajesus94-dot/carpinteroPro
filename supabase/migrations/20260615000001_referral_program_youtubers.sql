-- SDD-11: Platform-global YouTuber promoters table.
-- No workshop_id — platform-global entity per SDD-9 precedent.
-- RLS enabled with no authenticated policies; accessed only via admin Edge Functions with service_role.

CREATE TABLE public.youtubers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text NOT NULL,
  channel_url   text,
  contact_email text,
  payout_method text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtubers ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — service_role bypass only via admin Edge Functions.

CREATE TRIGGER youtubers_updated_at
  BEFORE UPDATE ON public.youtubers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Migration-level assertions ────────────────────────────────────
DO $$
DECLARE
  v_has_rls boolean;
  v_policy_count bigint;
BEGIN
  -- RLS enabled
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.youtubers'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on youtubers';
  END IF;

  -- No authenticated policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'youtubers'
    AND pol.polroles @> (SELECT array_agg(oid) FROM pg_roles WHERE rolname = 'authenticated');
  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: youtubers has % authenticated policies (must be 0)', v_policy_count;
  END IF;
END;
$$;
