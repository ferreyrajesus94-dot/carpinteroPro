-- Forward-only: founder lands as workshop_role = 'admin' on the workshop
-- created in this same trigger.
--
-- Replaces handle_new_user, preserving verbatim the workshop INSERT, the
-- terms/privacy consent capture from raw_user_meta_data, and the full
-- referral attribution block (case-insensitive lookup, unknown / inactive
-- / self-referral skipping, RAISE WARNING visibility, workshop_referrals
-- INSERT).
--
-- Only change: the profile INSERT adds workshop_role = 'admin' explicitly
-- for the workshop this trigger just created. The column DEFAULT 'viewer'
-- on profiles.workshop_role stays untouched, so every other code path
-- that relies on it keeps working. No guards, RLS, GRANT, backfill,
-- historical migration edits, or metadata authorization changes.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workshop_id  uuid;
  v_ref_code       text;
  v_code_record    record;
BEGIN
  -- ── 1. Always create workshop + profile (unchanged from previous migrations) ──
  INSERT INTO public.workshops (name)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'workshop_name', 'Mi Taller')
  )
  RETURNING id INTO new_workshop_id;

  INSERT INTO public.profiles (
    id, workshop_id, display_name, workshop_role,
    terms_accepted_at, privacy_accepted_at
  )
  VALUES (
    NEW.id,
    new_workshop_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'admin'::public.workshop_user_role,
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

  -- ── 2. Referral code processing ─────────────────────────────────────────────
  v_ref_code := NEW.raw_user_meta_data->>'referral_code';

  -- Skip if no referral_code key present
  IF v_ref_code IS NULL OR v_ref_code = '' THEN
    RETURN NEW;
  END IF;

  -- Look up the code case-insensitively
  SELECT rc.id, rc.youtuber_id, rc.is_active, y.contact_email
  INTO v_code_record
  FROM public.referral_codes rc
  JOIN public.youtubers y ON y.id = rc.youtuber_id
  WHERE LOWER(rc.code) = LOWER(v_ref_code);

  -- Unknown code — silently skip, log warning
  IF v_code_record.id IS NULL THEN
    RAISE WARNING 'code_attribution_skipped: reason=unknown_code code=% email=%',
      v_ref_code, NEW.email;
    RETURN NEW;
  END IF;

  -- Inactive code — silently skip, log warning
  IF NOT v_code_record.is_active THEN
    RAISE WARNING 'code_attribution_skipped: reason=inactive code=% email=%',
      v_ref_code, NEW.email;
    RETURN NEW;
  END IF;

  -- Self-referral check: signing-up user's email vs youtuber's contact_email
  IF LOWER(NEW.email) = LOWER(v_code_record.contact_email) THEN
    RAISE WARNING 'code_attribution_skipped: reason=self_referral code=% email=%',
      v_ref_code, NEW.email;
    RETURN NEW;
  END IF;

  -- All checks pass — insert attribution
  INSERT INTO public.workshop_referrals (workshop_id, referral_code_id, youtuber_id)
  VALUES (new_workshop_id, v_code_record.id, v_code_record.youtuber_id);

  RETURN NEW;
END;
$$;