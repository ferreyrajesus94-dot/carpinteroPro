-- ============================================================
-- Profile tenant immutability hardening
-- ============================================================
-- The trusted tenant resolver reads profiles.workshop_id. Authenticated
-- users may update safe profile fields, but they must not be able to
-- move their own profile to another workshop.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_profile_workshop_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.workshop_id IS DISTINCT FROM NEW.workshop_id
     AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'profiles.workshop_id cannot be changed by authenticated users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_workshop_id_change ON public.profiles;
CREATE TRIGGER prevent_profile_workshop_id_change
  BEFORE UPDATE OF workshop_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_workshop_id_change();
