-- ============================================================
-- FASE 3 PRE-LAUNCH: Onboarding inicial
-- ============================================================
-- Agrega `onboarded_at` a profiles para marcar si el usuario
-- ya completó (o saltó) el wizard inicial.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.onboarded_at IS
  'Fecha en que el usuario completó (o saltó) el wizard de onboarding. NULL = pendiente.';
