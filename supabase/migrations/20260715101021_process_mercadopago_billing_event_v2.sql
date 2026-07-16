-- Slice 2: local atomic boundary for normalized MercadoPago billing events.
-- Provider I/O stays outside this SECURITY INVOKER RPC.

CREATE OR REPLACE FUNCTION public.process_mercadopago_billing_event_v2(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_provider text := p_input ->> 'provider';
  v_event_id text := p_input ->> 'providerEventId';
  v_event_type text := p_input ->> 'eventType';
  v_resource_id text := p_input ->> 'providerResourceId';
  v_resource_kind text := p_input ->> 'resourceKind';
  v_preapproval_id text := p_input ->> 'providerPreapprovalId';
  v_provider_status text := p_input ->> 'providerStatus';
  v_snapshot_at timestamptz := nullif(p_input ->> 'providerSnapshotAt', '')::timestamptz;
  v_fetched_at timestamptz := nullif(p_input ->> 'providerFetchedAt', '')::timestamptz;
  v_subscription public.subscriptions%rowtype;
  v_event public.billing_webhook_events%rowtype;
  v_commission jsonb := p_input -> 'commission';
  v_reconciliation jsonb := p_input -> 'reconciliation';
  v_status text;
  v_commission_disposition text := 'not_applicable';
  v_existing_commission public.referral_commissions%rowtype;
  v_referral public.workshop_referrals%rowtype;
  v_commission_pct numeric;
      v_commission_amount numeric;
      v_payment_amount numeric;
      v_occurred_at timestamptz;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF p_input ? 'workshopId' OR p_input ? 'subscriptionId' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tenant authority is server-derived';
  END IF;
  IF p_input ->> 'contractVersion' <> '2'
    OR v_provider <> 'mercadopago'
    OR v_event_id IS NULL OR v_event_id = ''
    OR v_event_type IS NULL OR v_event_type = ''
    OR v_resource_id IS NULL OR v_resource_id = ''
    OR v_preapproval_id IS NULL OR v_preapproval_id = ''
    OR v_resource_kind NOT IN ('preapproval', 'payment', 'authorized_payment')
    OR v_provider_status IS NULL OR v_provider_status = ''
    OR v_fetched_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid v2 billing envelope';
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE provider = 'mercadopago' AND provider_preapproval_id = v_preapproval_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'not_applicable', 'reason', 'missing_subscription', 'retryable', false, 'duplicate', false, 'applied', false);
  END IF;

  INSERT INTO public.billing_webhook_events (
    provider, provider_event_id, event_type, provider_resource_id, provider_preapproval_id,
    provider_resource_kind, workshop_id, contract_version, outcome, processed_at, normalized_payload
  ) VALUES (
    v_provider, v_event_id, v_event_type, v_resource_id, v_preapproval_id,
    v_resource_kind, v_subscription.workshop_id, 2, 'retryable', v_now, p_input -> 'normalizedPayload'
  ) ON CONFLICT (provider, provider_event_id) DO NOTHING;

  SELECT * INTO v_event FROM public.billing_webhook_events
  WHERE provider = v_provider AND provider_event_id = v_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'XX000', MESSAGE = 'event lock invariant failed';
  END IF;

  IF v_event.contract_version = 2 THEN
    IF v_event.event_type IS DISTINCT FROM v_event_type
      OR v_event.provider_resource_id IS DISTINCT FROM v_resource_id
      OR v_event.provider_resource_kind IS DISTINCT FROM v_resource_kind
      OR v_event.provider_preapproval_id IS DISTINCT FROM v_preapproval_id
      OR v_event.workshop_id IS DISTINCT FROM v_subscription.workshop_id THEN
      RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'identity_conflict', 'reason', 'immutable_identity', 'retryable', false, 'duplicate', false, 'applied', false);
    END IF;
  ELSIF v_reconciliation ->> 'originalEventId' = v_event.id::text
    AND nullif(v_event.provider_resource_id, '') = v_resource_id
    AND v_event.provider = v_provider
    AND v_event.event_type = v_event_type
    AND (v_event.provider_preapproval_id IS NULL OR v_event.provider_preapproval_id = v_preapproval_id)
    AND (v_event.provider_resource_kind IS NULL OR v_event.provider_resource_kind = v_resource_kind)
    AND v_event.workshop_id = v_subscription.workshop_id THEN
    UPDATE public.billing_webhook_events SET
      contract_version = 2, provider_preapproval_id = coalesce(provider_preapproval_id, v_preapproval_id),
      provider_resource_kind = coalesce(provider_resource_kind, v_resource_kind),
      provider_snapshot_at = coalesce(provider_snapshot_at, v_snapshot_at), provider_fetched_at = coalesce(provider_fetched_at, v_fetched_at),
          reconciliation_count = reconciliation_count + 1, last_reconciled_at = v_now,
          last_reconciled_by = nullif(v_reconciliation ->> 'requestedBy', '')::uuid
    WHERE id = v_event.id;
    SELECT * INTO v_event FROM public.billing_webhook_events WHERE id = v_event.id;
  ELSE
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'legacy_uncertain', 'reason', 'legacy_identity', 'retryable', false, 'duplicate', false, 'applied', false);
  END IF;

  IF v_event.outcome = 'completed' THEN
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'duplicate', 'retryable', false, 'duplicate', true, 'applied', false, 'subscriptionId', v_subscription.id, 'attemptCount', v_event.attempt_count, 'completedAt', v_event.completed_at);
  END IF;

  SELECT * INTO v_subscription FROM public.subscriptions WHERE id = v_subscription.id FOR UPDATE;
  IF v_subscription.workshop_id <> v_event.workshop_id OR v_subscription.provider_preapproval_id <> v_preapproval_id THEN
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'identity_conflict', 'reason', 'subscription_changed', 'retryable', false, 'duplicate', false, 'applied', false);
  END IF;
  IF v_snapshot_at IS NOT NULL AND v_subscription.provider_snapshot_at IS NOT NULL AND v_snapshot_at < v_subscription.provider_snapshot_at THEN
    UPDATE public.billing_webhook_events SET outcome = 'stale', outcome_reason = 'older_snapshot', attempt_count = attempt_count + 1, last_attempted_at = v_now WHERE id = v_event.id;
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'stale', 'retryable', false, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
  END IF;
  IF v_snapshot_at = v_subscription.provider_snapshot_at
    AND v_snapshot_at IS NOT NULL
    AND v_subscription.provider_fetched_at IS NOT NULL
    AND v_fetched_at < v_subscription.provider_fetched_at THEN
    UPDATE public.billing_webhook_events SET outcome = 'stale', outcome_reason = 'older_fetch', attempt_count = attempt_count + 1, last_attempted_at = v_now WHERE id = v_event.id;
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'stale', 'retryable', false, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
  END IF;
  IF v_snapshot_at IS NULL AND (
        v_resource_kind <> 'preapproval'
        OR v_resource_id <> v_subscription.provider_preapproval_id
        OR (v_subscription.provider_snapshot_at IS NOT NULL AND (
          v_subscription.provider_snapshot_resource_kind IS DISTINCT FROM v_resource_kind
          OR v_subscription.provider_snapshot_resource_id IS DISTINCT FROM v_resource_id
          OR v_subscription.provider_fetched_at IS NULL OR v_fetched_at <= v_subscription.provider_fetched_at
        ))
      ) THEN
        UPDATE public.billing_webhook_events SET outcome = 'uncertain', outcome_reason = 'missing_provider_timestamp', attempt_count = attempt_count + 1, last_attempted_at = v_now WHERE id = v_event.id;
        RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'uncertain', 'reason', 'missing_provider_timestamp', 'retryable', false, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
      END IF;
      IF v_snapshot_at = v_subscription.provider_snapshot_at AND v_snapshot_at IS NOT NULL
        AND (v_subscription.provider_snapshot_resource_kind IS DISTINCT FROM v_resource_kind OR v_subscription.provider_snapshot_resource_id IS DISTINCT FROM v_resource_id) THEN
        UPDATE public.billing_webhook_events SET outcome = 'uncertain', outcome_reason = 'ambiguous_order', attempt_count = attempt_count + 1, last_attempted_at = v_now WHERE id = v_event.id;
        RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'uncertain', 'reason', 'ambiguous_order', 'retryable', false, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
      END IF;
      v_status := CASE v_provider_status
    WHEN 'authorized' THEN 'active'
    WHEN 'active' THEN 'active'
    WHEN 'paused' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE NULL END;
  IF v_status IS NULL THEN
    UPDATE public.billing_webhook_events SET outcome = 'uncertain', outcome_reason = 'unknown_provider_status', attempt_count = attempt_count + 1, last_attempted_at = v_now WHERE id = v_event.id;
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'uncertain', 'reason', 'unknown_provider_status', 'retryable', false, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
  END IF;

  BEGIN
    UPDATE public.subscriptions SET status = v_status, provider_status = v_provider_status,
      provider_snapshot_at = coalesce(v_snapshot_at, provider_snapshot_at),
          provider_snapshot_resource_kind = case when v_snapshot_at is null then provider_snapshot_resource_kind else v_resource_kind end,
      provider_snapshot_resource_id = case when v_snapshot_at is null then provider_snapshot_resource_id else v_resource_id end,
          provider_fetched_at = greatest(coalesce(provider_fetched_at, '-infinity'::timestamptz), v_fetched_at)
    WHERE id = v_subscription.id;
    IF v_resource_kind IN ('payment', 'authorized_payment') THEN
      SELECT * INTO v_referral FROM public.workshop_referrals WHERE workshop_id = v_subscription.workshop_id;
        IF FOUND AND v_commission IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'required commission missing';
        END IF;
        IF v_commission IS NOT NULL THEN
      IF v_commission ->> 'providerPaymentId' IS NULL OR v_commission ->> 'providerPaymentId' = '' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid commission';
      END IF;
      SELECT * INTO v_referral FROM public.workshop_referrals WHERE workshop_id = v_subscription.workshop_id;
      IF FOUND THEN
        SELECT commission_pct INTO v_commission_pct FROM public.referral_codes WHERE id = v_referral.referral_code_id;
            v_payment_amount := (v_commission ->> 'paymentAmount')::numeric;
            v_occurred_at := (v_commission ->> 'occurredAt')::timestamptz;
            v_commission_amount := pg_catalog.round(v_payment_amount * v_commission_pct / 100, 2);
        INSERT INTO public.referral_commissions (workshop_id, youtuber_id, referral_code_id, subscription_id, provider_payment_id, payment_amount, commission_pct, commission_amount, currency, occurred_at)
        VALUES (v_subscription.workshop_id, v_referral.youtuber_id, v_referral.referral_code_id, v_subscription.id, v_commission ->> 'providerPaymentId', v_payment_amount, v_commission_pct, v_commission_amount, coalesce(v_commission ->> 'currency', 'ARS'), v_occurred_at)
        ON CONFLICT (provider_payment_id) DO NOTHING;
        IF NOT FOUND THEN
          SELECT * INTO v_existing_commission FROM public.referral_commissions WHERE provider_payment_id = v_commission ->> 'providerPaymentId';
          IF v_existing_commission.workshop_id IS DISTINCT FROM v_subscription.workshop_id OR v_existing_commission.subscription_id IS DISTINCT FROM v_subscription.id
                OR v_existing_commission.youtuber_id IS DISTINCT FROM v_referral.youtuber_id OR v_existing_commission.referral_code_id IS DISTINCT FROM v_referral.referral_code_id
                OR v_existing_commission.payment_amount IS DISTINCT FROM v_payment_amount OR v_existing_commission.commission_pct IS DISTINCT FROM v_commission_pct
                OR v_existing_commission.commission_amount IS DISTINCT FROM v_commission_amount OR v_existing_commission.currency IS DISTINCT FROM coalesce(v_commission ->> 'currency', 'ARS')
                OR v_existing_commission.occurred_at IS DISTINCT FROM v_occurred_at THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'commission conflict';
          END IF;
          v_commission_disposition := 'existing';
        ELSE v_commission_disposition := 'recorded'; END IF;
      END IF;
    END IF;
    END IF;
    UPDATE public.billing_webhook_events SET outcome = 'completed', outcome_reason = NULL, attempt_count = attempt_count + 1, last_attempted_at = v_now, completed_at = v_now, last_error_code = NULL, last_error_detail = NULL, provider_snapshot_at = coalesce(v_snapshot_at, provider_snapshot_at), provider_fetched_at = greatest(coalesce(provider_fetched_at, '-infinity'::timestamptz), v_fetched_at), normalized_payload = p_input -> 'normalizedPayload' WHERE id = v_event.id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.billing_webhook_events SET outcome = 'retryable', outcome_reason = 'local_failure', attempt_count = attempt_count + 1, last_attempted_at = v_now, last_error_code = SQLSTATE, last_error_detail = left(SQLERRM, 500) WHERE id = v_event.id;
    RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'retryable', 'reason', 'local_failure', 'retryable', true, 'duplicate', false, 'applied', false, 'subscriptionId', v_subscription.id);
  END;
  RETURN pg_catalog.jsonb_build_object('eventId', v_event.id, 'outcome', 'completed', 'retryable', false, 'duplicate', false, 'applied', true, 'subscriptionId', v_subscription.id, 'commissionDisposition', v_commission_disposition, 'attemptCount', v_event.attempt_count + 1, 'completedAt', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.billing_webhook_events TO service_role;
GRANT SELECT, UPDATE ON public.subscriptions TO service_role;
GRANT SELECT ON public.workshop_referrals, public.referral_codes TO service_role;
GRANT SELECT, INSERT ON public.referral_commissions TO service_role;
