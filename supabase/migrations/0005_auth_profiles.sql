-- ============================================================
-- FASE 5: Auth real con Supabase Auth
-- ============================================================
-- Crea la tabla `workshops` (fuente de verdad del taller)
-- y `profiles` (vincula auth.users → workshop_id).
-- Un trigger auto-crea workshop + profile al registrarse un usuario.
-- ============================================================

-- 1. Tabla workshops
CREATE TABLE IF NOT EXISTS public.workshops (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insertar el taller placeholder usado en desarrollo
INSERT INTO public.workshops (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Taller Demo')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workshop_id  uuid        NOT NULL REFERENCES public.workshops(id),
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. Función: al crear un nuevo usuario, crear workshop + profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workshop_id uuid;
BEGIN
  INSERT INTO public.workshops (name)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'workshop_name', 'Mi Taller')
  )
  RETURNING id INTO new_workshop_id;

  INSERT INTO public.profiles (id, workshop_id, display_name)
  VALUES (
    NEW.id,
    new_workshop_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  RETURN NEW;
END;
$$;

-- 4. Trigger que dispara handle_new_user al registrarse
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
