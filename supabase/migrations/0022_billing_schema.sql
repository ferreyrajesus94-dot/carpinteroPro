CREATE TABLE public.subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id               uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  status                    text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'unpaid', 'cancelled')),
  plan                      text NOT NULL DEFAULT 'pro_monthly',
  provider                  text NOT NULL DEFAULT 'mercadopago',
  trial_starts_at           timestamptz,
  trial_ends_at             timestamptz,
  current_period_starts_at  timestamptz,
  current_period_ends_at    timestamptz,
  provider_subscription_id  text,
  provider_preapproval_id   text,
  provider_status           text,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,
  cancelled_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_one_per_workshop
  ON public.subscriptions(workshop_id);

CREATE INDEX subscriptions_workshop_id_idx
  ON public.subscriptions(workshop_id);

CREATE UNIQUE INDEX subscriptions_provider_preapproval_id_idx
  ON public.subscriptions(provider_preapproval_id)
  WHERE provider_preapproval_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (workshop_id = public.get_current_workshop_id());

GRANT SELECT ON public.subscriptions TO authenticated;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.billing_webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL DEFAULT 'mercadopago',
  provider_event_id   text NOT NULL,
  event_type          text NOT NULL,
  provider_resource_id text,
  workshop_id         uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  processed_at        timestamptz NOT NULL DEFAULT now(),
  payload             jsonb NOT NULL DEFAULT '{}',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX billing_webhook_events_provider_event_id_idx
  ON public.billing_webhook_events(provider, provider_event_id);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER billing_webhook_events_updated_at
  BEFORE UPDATE ON public.billing_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.start_trial_on_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.onboarded_at IS NULL AND NEW.onboarded_at IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      workshop_id,
      status,
      plan,
      provider,
      trial_starts_at,
      trial_ends_at
    )
    VALUES (
      NEW.workshop_id,
      'trialing',
      'pro_monthly',
      'mercadopago',
      now(),
      now() + interval '14 days'
    )
    ON CONFLICT (workshop_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS start_trial_on_onboarding ON public.profiles;
CREATE TRIGGER start_trial_on_onboarding
  AFTER UPDATE OF onboarded_at ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.start_trial_on_onboarding();

DO $$
DECLARE
  v_policy_qual text;
  v_trig_when text;
  v_func_body text;
  v_has_rls boolean;
  v_workshop_a uuid := '10000000-0000-0000-0000-000000000001'::uuid;
  v_workshop_b uuid := '10000000-0000-0000-0000-000000000002'::uuid;
  v_workshop_c uuid := '10000000-0000-0000-0000-000000000003'::uuid;
  v_user_a uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  v_user_b uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_subscription_a uuid;
  v_subscription_b uuid;
  v_visible_count int;
  v_trial_count int;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_changed_count int;
BEGIN
  SELECT relrowsecurity INTO v_has_rls FROM pg_class WHERE oid = 'public.billing_webhook_events'::regclass;
  IF NOT v_has_rls THEN
    RAISE EXCEPTION 'Assertion failed: RLS not enabled on billing_webhook_events';
  END IF;

  SELECT pg_get_expr(pol.polqual, pol.polrelid) INTO v_policy_qual
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'subscriptions'
    AND pol.polname = 'subscriptions_select_own';
  IF v_policy_qual IS NULL OR v_policy_qual NOT LIKE '%get_current_workshop_id%' THEN
    RAISE EXCEPTION 'Assertion failed: subscriptions_select_own policy does not use get_current_workshop_id()';
  END IF;

  SELECT CASE WHEN tg.tgtype & 2 = 2 THEN 'BEFORE' WHEN tg.tgtype & 64 = 64 THEN 'INSTEAD' ELSE 'AFTER' END
  INTO v_trig_when
  FROM pg_trigger tg
  WHERE tg.tgname = 'start_trial_on_onboarding'
    AND tg.tgrelid = 'public.profiles'::regclass;
  IF v_trig_when != 'AFTER' THEN
    RAISE EXCEPTION 'Assertion failed: trial trigger timing is %, expected AFTER', v_trig_when;
  END IF;

  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'start_trial_on_onboarding';
  IF v_func_body IS NULL OR v_func_body NOT LIKE '%ON CONFLICT%' THEN
    RAISE EXCEPTION 'Assertion failed: trial trigger function missing ON CONFLICT idempotency';
  END IF;

  INSERT INTO public.workshops (id, name)
  VALUES
    (v_workshop_a, 'Billing RLS Test A'),
    (v_workshop_b, 'Billing RLS Test B'),
    (v_workshop_c, 'Billing RLS Test C')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing-rls-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing-rls-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, workshop_id, display_name)
  VALUES (v_user_a, v_workshop_a, 'Billing RLS A'), (v_user_b, v_workshop_b, 'Billing RLS B')
  ON CONFLICT (id) DO UPDATE
  SET workshop_id = EXCLUDED.workshop_id,
      display_name = EXCLUDED.display_name,
      onboarded_at = NULL;

  INSERT INTO public.subscriptions (workshop_id, status, plan, provider, trial_starts_at, trial_ends_at)
  VALUES
    (v_workshop_a, 'trialing', 'pro_monthly', 'mercadopago', now(), now() + interval '14 days'),
    (v_workshop_b, 'trialing', 'pro_monthly', 'mercadopago', now(), now() + interval '14 days')
  ON CONFLICT (workshop_id) DO NOTHING;

  SELECT id INTO v_subscription_a FROM public.subscriptions WHERE workshop_id = v_workshop_a;
  SELECT id INTO v_subscription_b FROM public.subscriptions WHERE workshop_id = v_workshop_b;

  IF NOT has_table_privilege('authenticated', 'public.subscriptions', 'SELECT') THEN
    RAISE EXCEPTION 'Assertion failed: authenticated role must have SELECT privilege on subscriptions';
  END IF;

  DELETE FROM public.subscriptions WHERE workshop_id = v_workshop_a;
  UPDATE public.profiles SET onboarded_at = NULL WHERE id = v_user_a;
  UPDATE public.profiles SET onboarded_at = now() WHERE id = v_user_a;

  SELECT COUNT(*), min(trial_starts_at), min(trial_ends_at)
  INTO v_trial_count, v_trial_start, v_trial_end
  FROM public.subscriptions
  WHERE workshop_id = v_workshop_a
    AND status = 'trialing';

  IF v_trial_count != 1 THEN
    RAISE EXCEPTION 'Assertion failed: onboarding trigger should create exactly one trial row, created %', v_trial_count;
  END IF;
  IF v_trial_start IS NULL OR v_trial_end IS NULL OR v_trial_end <= v_trial_start THEN
    RAISE EXCEPTION 'Assertion failed: onboarding trigger did not set valid trial dates';
  END IF;
  IF v_trial_end < v_trial_start + interval '13 days 23 hours' OR v_trial_end > v_trial_start + interval '14 days 1 hour' THEN
    RAISE EXCEPTION 'Assertion failed: trial end is not approximately 14 days after trial start';
  END IF;

  UPDATE public.profiles SET onboarded_at = now() + interval '1 hour' WHERE id = v_user_a;
  SELECT COUNT(*), min(trial_starts_at), min(trial_ends_at)
  INTO v_trial_count, v_trial_start, v_trial_end
  FROM public.subscriptions
  WHERE workshop_id = v_workshop_a;
  IF v_trial_count != 1 THEN
    RAISE EXCEPTION 'Assertion failed: onboarding trigger is not idempotent, row count %', v_trial_count;
  END IF;

  INSERT INTO public.billing_webhook_events (workshop_id, provider_event_id, event_type, provider_resource_id)
  VALUES (v_workshop_a, 'evt_billing_assertion', 'preapproval.updated', 'preapproval_assertion');
  BEGIN
    INSERT INTO public.billing_webhook_events (workshop_id, provider_event_id, event_type, provider_resource_id)
    VALUES (v_workshop_a, 'evt_billing_assertion', 'preapproval.updated', 'preapproval_assertion');
    RAISE EXCEPTION 'Assertion failed: duplicate provider_event_id unexpectedly succeeded';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  DELETE FROM public.billing_webhook_events WHERE workshop_id IN (v_workshop_a, v_workshop_b);
  DELETE FROM public.subscriptions WHERE workshop_id IN (v_workshop_a, v_workshop_b);
  DELETE FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM public.workshops WHERE id IN (v_workshop_a, v_workshop_b, v_workshop_c);
END;
$$;
