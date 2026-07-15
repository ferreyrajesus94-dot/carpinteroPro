-- Slice 1: additive schema for retryable MercadoPago webhook processing.
-- This migration intentionally contains no RPC or runtime-handler adoption.

ALTER TABLE public.billing_webhook_events
  ADD COLUMN contract_version smallint NOT NULL DEFAULT 1
    CHECK (contract_version IN (1, 2)),
  ADD COLUMN outcome text NOT NULL DEFAULT 'legacy_uncertain'
    CHECK (outcome IN ('legacy_uncertain', 'retryable', 'completed', 'terminal', 'stale', 'uncertain')),
  ADD COLUMN outcome_reason text,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  ADD COLUMN last_attempted_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN last_error_code text
    CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 100),
  ADD COLUMN last_error_detail text
    CHECK (last_error_detail IS NULL OR char_length(last_error_detail) <= 500),
  ADD COLUMN provider_resource_kind text
    CHECK (provider_resource_kind IS NULL OR provider_resource_kind IN ('preapproval', 'payment', 'authorized_payment')),
  ADD COLUMN provider_preapproval_id text,
  ADD COLUMN provider_snapshot_at timestamptz,
  ADD COLUMN provider_fetched_at timestamptz,
  ADD COLUMN normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN reconciliation_count integer NOT NULL DEFAULT 0
    CHECK (reconciliation_count >= 0),
  ADD COLUMN last_reconciled_at timestamptz,
  ADD COLUMN last_reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX billing_webhook_events_retryable_operational_idx
  ON public.billing_webhook_events (last_attempted_at)
  WHERE outcome IN ('retryable', 'uncertain', 'legacy_uncertain');

ALTER TABLE public.subscriptions
  ADD COLUMN provider_snapshot_at timestamptz,
  ADD COLUMN provider_snapshot_resource_kind text,
  ADD COLUMN provider_snapshot_resource_id text,
  ADD COLUMN provider_fetched_at timestamptz;
