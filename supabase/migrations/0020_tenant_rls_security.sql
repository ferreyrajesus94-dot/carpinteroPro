-- ============================================================
-- Tenant RLS security hardening
-- ============================================================
-- Replaces client-controlled x-workshop-id tenant resolution with
-- a server-derived lookup from the authenticated user's profile.
-- Also protects the workshops table with own-workshop RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_workshop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
$$;

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workshops_select_own" ON public.workshops;
CREATE POLICY "workshops_select_own"
  ON public.workshops
  FOR SELECT
  TO authenticated
  USING (id = public.get_current_workshop_id());

DROP POLICY IF EXISTS "workshops_update_own" ON public.workshops;
CREATE POLICY "workshops_update_own"
  ON public.workshops
  FOR UPDATE
  TO authenticated
  USING (id = public.get_current_workshop_id())
  WITH CHECK (id = public.get_current_workshop_id());
