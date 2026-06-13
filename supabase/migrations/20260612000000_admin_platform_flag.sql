-- Add platform-admin flag to existing profiles table.
-- This avoids a new platform-global table that would violate the project rule
-- requiring workshop_id on every new table, since profiles already has workshop_id, RLS,
-- and own-profile visibility through the existing tenant security model.

ALTER TABLE profiles
  ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

-- All existing profiles default to non-admin via the DEFAULT false above.
-- No backfill needed.

-- The existing profiles_update_own policy lets users update safe profile fields.
-- Lock the platform-admin flag so authenticated users cannot promote themselves
-- through a direct PostgREST/Supabase client update. Trusted SQL contexts with no
-- end-user JWT (for example Supabase SQL Editor or service-role maintenance code)
-- can still perform the manual bootstrap below.
CREATE OR REPLACE FUNCTION public.prevent_platform_admin_self_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.is_platform_admin IS DISTINCT FROM NEW.is_platform_admin
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'profiles.is_platform_admin cannot be changed by authenticated users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_platform_admin_self_promotion ON public.profiles;
CREATE TRIGGER prevent_platform_admin_self_promotion
  BEFORE UPDATE OF is_platform_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_platform_admin_self_promotion();

-- ── Bootstrap the first platform admin ──────────────────────────────────────
-- Run this manually in Supabase SQL Editor or a trusted psql/migration context
-- after the first super-admin's auth.users row exists.
--
--   UPDATE profiles
--   SET is_platform_admin = true
--   WHERE id = '<auth_user_id>';
--
-- Verify:
--   SELECT id, email, is_platform_admin FROM profiles
--   JOIN auth.users ON auth.users.id = profiles.id;
--
-- No public UI can grant is_platform_admin in the MVP. Self-service admin
-- promotion is out of scope for SDD9. If admin membership becomes auditable
-- later, migrate to a dedicated platform_admin_memberships table.
