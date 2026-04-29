-- ============================================================
-- FASE 2 PRE-LAUNCH: Consentimiento legal
-- ============================================================
-- Agrega `terms_accepted_at` y `privacy_accepted_at` a profiles
-- para registrar cuándo el usuario aceptó los términos (Ley 25.326 AR).
-- El trigger handle_new_user los lee de raw_user_meta_data.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp UTC en que el usuario aceptó los Términos y Condiciones (Ley 25.326 AR).';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS
  'Timestamp UTC en que el usuario aceptó la Política de Privacidad (Ley 25.326 AR).';

-- Actualizar el trigger para persistir los timestamps desde metadata
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

  INSERT INTO public.profiles (id, workshop_id, display_name, terms_accepted_at, privacy_accepted_at)
  VALUES (
    NEW.id,
    new_workshop_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE
      WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'privacy_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'privacy_accepted_at')::timestamptz
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$$;
